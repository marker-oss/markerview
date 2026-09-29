package external_sources

import (
	"strings"
	"testing"
)

func TestParseOzonCSVNormalizesReview(t *testing.T) {
	csv := "\ufeffАртикул;SKU;Название товара;Номер заказа;Статус получения;Текст отзыва;Дата публикации;Статус отзыва;Оценка;Количество фото;Количество видео;Количество ответов на отзыв\n" +
		"A-1;SKU-1;Товар;ORDER-1;Получен;Отличный товар;2026-09-29T10:00:00Z;Опубликован;5;0;0;0\n"
	preview, err := ParseOzonCSV(strings.NewReader(csv))
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Reviews) != 1 || len(preview.Errors) != 0 {
		t.Fatalf("preview = %+v", preview)
	}
	got := preview.Reviews[0]
	if got.Marketplace != "ozon" || got.SourceKind != "imported" || got.SourceMethod != "csv" {
		t.Fatalf("source = %q/%q/%q", got.Marketplace, got.SourceKind, got.SourceMethod)
	}
	if got.ExternalReviewID != "order:ORDER-1|sku:SKU-1" || got.ExternalProductID != "SKU-1" || got.SellerArticle != "A-1" || got.Text != "Отличный товар" {
		t.Fatalf("review = %+v", got)
	}
}

func TestParseOzonCSVReportsBadRows(t *testing.T) {
	csv := "Артикул;SKU;Название товара;Номер заказа;Статус получения;Текст отзыва;Дата публикации;Статус отзыва;Оценка;Количество фото;Количество видео;Количество ответов на отзыв\n" +
		"A-1;SKU-1;Товар;ORDER-1;Получен;;not-a-date;Опубликован;5;0;0;0\n"
	preview, err := ParseOzonCSV(strings.NewReader(csv))
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Reviews) != 0 || len(preview.Errors) != 1 || preview.Errors[0].Row != 2 {
		t.Fatalf("preview = %+v", preview)
	}
}

func TestParseOzonCSVSupportsCabinetDateAndRatingErrors(t *testing.T) {
	input := ozonCSVHeader + "\nA;S;T;O;Получен;Текст;2026-09-29 10:00:00;Опубликован;6;0;0;0\n"
	preview, err := ParseOzonCSV(strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Reviews) != 0 || len(preview.Errors) != 1 || !strings.Contains(preview.Errors[0].Message, "rating") {
		t.Fatalf("preview = %+v", preview)
	}
}
