package server

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"reviews/internal/marketplace"
	"reviews/internal/store"
)

func TestOzonCSVImportPreviewAndCommit(t *testing.T) {
	s := newAuthTestServer(t)
	cookie := loginTestAdmin(t, s)
	csrf := getCSRFToken(t, s, cookie)
	csv := "Артикул;SKU;Название товара;Номер заказа;Статус получения;Текст отзыва;Дата публикации;Статус отзыва;Оценка;Количество фото;Количество видео;Количество ответов на отзыв\n" +
		"A-1;SKU-1;Товар;ORDER-1;Получен;Отличный товар;2026-09-29T10:00:00Z;Опубликован;5;0;0;0\n"
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "reviews.csv")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte(csv)); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/admin/api/imports/ozon/preview", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.AddCookie(cookie)
	request.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
	request.Header.Set(csrfHeaderName, csrf)
	record := httptest.NewRecorder()
	s.adminMux().ServeHTTP(record, request)
	if record.Code != http.StatusOK {
		t.Fatalf("preview status = %d, body=%s", record.Code, record.Body.String())
	}
	var preview struct {
		Token  string `json:"token"`
		Total  int    `json:"total"`
		Errors int    `json:"errors"`
	}
	if err := json.NewDecoder(record.Body).Decode(&preview); err != nil {
		t.Fatal(err)
	}
	if preview.Token == "" || preview.Total != 1 || preview.Errors != 0 {
		t.Fatalf("preview = %+v", preview)
	}
	request = httptest.NewRequest(http.MethodPost, "/admin/api/imports/ozon/commit", strings.NewReader(`{"token":"`+preview.Token+`"}`))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(cookie)
	request.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
	request.Header.Set(csrfHeaderName, csrf)
	record = httptest.NewRecorder()
	s.adminMux().ServeHTTP(record, request)
	if record.Code != http.StatusOK {
		t.Fatalf("commit status = %d, body=%s", record.Code, record.Body.String())
	}
	reviews, err := s.store.ListReviews(context.Background(), store.ReviewListFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(reviews) != 1 || reviews[0].Marketplace != "ozon" || reviews[0].SourceMethod != marketplace.SourceMethodCSV {
		t.Fatalf("reviews = %+v", reviews)
	}
}

func TestCanonicalNonOzonCSVImport(t *testing.T) {
	testCanonicalAdminImport(t, "wb", "reviews.csv", []byte("marketplace_review_id,provider_record_id,external_product_id,seller_article,author_name,rating,title,text,pros,cons,created_at,updated_at\nmarket-1,provider-1,product-1,article-1,Ada,5,Title,Review,Good,,2026-09-29T10:00:00Z,\n"))
}

func TestCanonicalNonOzonXLSXImport(t *testing.T) {
	sheet := `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c r="A1" t="inlineStr"><is><t>marketplace_review_id</t></is></c><c r="B1" t="inlineStr"><is><t>provider_record_id</t></is></c><c r="C1" t="inlineStr"><is><t>external_product_id</t></is></c><c r="D1" t="inlineStr"><is><t>seller_article</t></is></c><c r="E1" t="inlineStr"><is><t>author_name</t></is></c><c r="F1" t="inlineStr"><is><t>rating</t></is></c><c r="G1" t="inlineStr"><is><t>title</t></is></c><c r="H1" t="inlineStr"><is><t>text</t></is></c><c r="I1" t="inlineStr"><is><t>pros</t></is></c><c r="J1" t="inlineStr"><is><t>cons</t></is></c><c r="K1" t="inlineStr"><is><t>created_at</t></is></c><c r="L1" t="inlineStr"><is><t>updated_at</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>market-2</t></is></c><c r="B2" t="inlineStr"><is><t>provider-2</t></is></c><c r="C2" t="inlineStr"><is><t>product-2</t></is></c><c r="D2" t="inlineStr"><is><t>article-2</t></is></c><c r="E2" t="inlineStr"><is><t>Bob</t></is></c><c r="F2" t="inlineStr"><is><t>4</t></is></c><c r="G2" t="inlineStr"><is><t>Title 2</t></is></c><c r="H2" t="inlineStr"><is><t>Review 2</t></is></c><c r="I2" t="inlineStr"><is><t>Good 2</t></is></c><c r="J2" t="inlineStr"><is><t>Bad 2</t></is></c><c r="K2" t="inlineStr"><is><t>2026-09-29T10:00:00Z</t></is></c></row></sheetData></worksheet>`
	var data bytes.Buffer
	zw := zip.NewWriter(&data)
	part, err := zw.Create("xl/worksheets/sheet1.xml")
	if err != nil { t.Fatal(err) }
	if _, err := io.WriteString(part, sheet); err != nil { t.Fatal(err) }
	if err := zw.Close(); err != nil { t.Fatal(err) }
	testCanonicalAdminImport(t, "ym", "reviews.xlsx", data.Bytes())
}

func testCanonicalAdminImport(t *testing.T, marketplaceName, filename string, contents []byte) {
	t.Helper()
	s := newAuthTestServer(t)
	cookie := loginTestAdmin(t, s)
	csrf := getCSRFToken(t, s, cookie)
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil { t.Fatal(err) }
	if _, err := part.Write(contents); err != nil { t.Fatal(err) }
	if err := writer.WriteField("marketplace", marketplaceName); err != nil { t.Fatal(err) }
	if err := writer.WriteField("format", "canonical"); err != nil { t.Fatal(err) }
	if err := writer.Close(); err != nil { t.Fatal(err) }
	request := httptest.NewRequest(http.MethodPost, "/admin/api/imports/ozon/preview", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.AddCookie(cookie)
	request.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
	request.Header.Set(csrfHeaderName, csrf)
	record := httptest.NewRecorder()
	s.adminMux().ServeHTTP(record, request)
	if record.Code != http.StatusOK { t.Fatalf("preview status = %d, body=%s", record.Code, record.Body.String()) }
	var preview struct { Token string `json:"token"`; Total int `json:"total"`; Errors int `json:"errors"` }
	if err := json.NewDecoder(record.Body).Decode(&preview); err != nil { t.Fatal(err) }
	if preview.Token == "" || preview.Total != 1 || preview.Errors != 0 { t.Fatalf("preview = %+v", preview) }
	request = httptest.NewRequest(http.MethodPost, "/admin/api/imports/ozon/commit", strings.NewReader(`{"token":"`+preview.Token+`"}`))
	request.Header.Set("Content-Type", "application/json")
	request.AddCookie(cookie)
	request.AddCookie(&http.Cookie{Name: csrfCookieName, Value: csrf})
	request.Header.Set(csrfHeaderName, csrf)
	record = httptest.NewRecorder()
	s.adminMux().ServeHTTP(record, request)
	if record.Code != http.StatusOK { t.Fatalf("commit status = %d, body=%s", record.Code, record.Body.String()) }
	reviews, err := s.store.ListReviews(context.Background(), store.ReviewListFilter{})
	if err != nil { t.Fatal(err) }
	if len(reviews) != 1 || reviews[0].Marketplace != marketplaceName || reviews[0].SourceMethod != map[string]string{"reviews.csv": marketplace.SourceMethodCSV, "reviews.xlsx": marketplace.SourceMethodXLSX}[filename] {
		t.Fatalf("reviews = %+v", reviews)
	}
}
