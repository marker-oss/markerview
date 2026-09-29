package external_sources

import (
	"bytes"
	"testing"
)

func TestParseCanonicalCSV(t *testing.T) {
	csv := "marketplace_review_id,provider_record_id,external_product_id,seller_article,author_name,rating,title,text,pros,cons,created_at,updated_at\n" +
		"market-id,provider-1,prod-1,article-1,Ada,5,Title,Review text,Good,,2026-09-29T10:00:00Z,2026-09-29T11:00:00Z\n"
	preview, err := ParseCanonicalCSV(bytes.NewBufferString(csv))
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Errors) != 0 || len(preview.Reviews) != 1 {
		t.Fatalf("preview=%+v", preview)
	}
	record := preview.Reviews[0]
	if record.ProviderRecordID != "provider-1" || record.Review.ExternalReviewID != "market-id" || record.Review.Text != "Review text" || record.Review.Rating == nil || *record.Review.Rating != 5 {
		t.Fatalf("record=%+v", record)
	}
}

func TestParseCanonicalXLSX(t *testing.T) {
	sheet := `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c r="A1" t="inlineStr"><is><t>marketplace_review_id</t></is></c><c r="B1" t="inlineStr"><is><t>provider_record_id</t></is></c><c r="C1" t="inlineStr"><is><t>external_product_id</t></is></c><c r="D1" t="inlineStr"><is><t>seller_article</t></is></c><c r="E1" t="inlineStr"><is><t>rating</t></is></c><c r="F1" t="inlineStr"><is><t>text</t></is></c><c r="G1" t="inlineStr"><is><t>created_at</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>market-2</t></is></c><c r="B2" t="inlineStr"><is><t>provider-2</t></is></c><c r="C2" t="inlineStr"><is><t>prod-2</t></is></c><c r="D2" t="inlineStr"><is><t>article-2</t></is></c><c r="E2" t="inlineStr"><is><t>4</t></is></c><c r="F2" t="inlineStr"><is><t>Text 2</t></is></c><c r="G2" t="inlineStr"><is><t>2026-09-29T10:00:00Z</t></is></c></row></sheetData></worksheet>`
	data := makeXLSXWithShared(t, sheet, "")
	preview, err := ParseCanonicalXLSX(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Errors) != 0 || len(preview.Reviews) != 1 || preview.Reviews[0].ProviderRecordID != "provider-2" {
		t.Fatalf("preview=%+v", preview)
	}
}

func TestParseCanonicalCSVValidatesRows(t *testing.T) {
	csv := "text,created_at,rating\nmissing-date,,5\nbad-date,not-a-time,5\nbad-rating,2026-09-29T10:00:00Z,6\n"
	preview, err := ParseCanonicalCSV(bytes.NewBufferString(csv))
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Reviews) != 0 || len(preview.Errors) != 3 {
		t.Fatalf("preview=%+v", preview)
	}
}
