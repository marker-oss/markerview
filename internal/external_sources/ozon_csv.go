package external_sources

import (
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"reviews/internal/marketplace"
)

const ozonCSVHeader = "Артикул;SKU;Название товара;Номер заказа;Статус получения;Текст отзыва;Дата публикации;Статус отзыва;Оценка;Количество фото;Количество видео;Количество ответов на отзыв"

var ozonCSVColumns = []string{"Артикул", "SKU", "Текст отзыва", "Дата публикации", "Оценка", "Номер заказа"}

type RowIssue struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

type Preview struct {
	Reviews []marketplace.Review
	Errors  []RowIssue
}

func ParseOzonCSV(r io.Reader) (Preview, error) {
	reader := csv.NewReader(&bomReader{r: r})
	reader.Comma = ';'
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true
	var preview Preview
	line := 0
	var columns map[string]int
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		line++
		if err != nil {
			return Preview{}, fmt.Errorf("line %d: %w", line, err)
		}
		if line == 1 {
			columns = make(map[string]int, len(record))
			for i, name := range record {
				name = strings.TrimSpace(strings.TrimPrefix(name, "\ufeff"))
				if name != "" {
					columns[name] = i
				}
			}
			missing := make([]string, 0)
			for _, name := range ozonCSVColumns {
				if _, ok := columns[name]; !ok {
					missing = append(missing, name)
				}
			}
			if len(missing) != 0 {
				preview.Errors = append(preview.Errors, RowIssue{Row: 1, Message: "missing Ozon CSV columns: " + strings.Join(missing, ", ")})
				return preview, nil
			}
			continue
		}
		value := func(name string) string {
			i, ok := columns[name]
			if !ok || i >= len(record) {
				return ""
			}
			return strings.TrimSpace(record[i])
		}
		article, sku, order, text := value("Артикул"), value("SKU"), value("Номер заказа"), value("Текст отзыва")
		if article == "" || sku == "" || order == "" || text == "" {
			preview.Errors = append(preview.Errors, RowIssue{Row: line, Message: "article, SKU, order number, and text are required"})
			continue
		}
		created, err := parseOzonDate(value("Дата публикации"))
		if err != nil {
			preview.Errors = append(preview.Errors, RowIssue{Row: line, Message: "invalid publication date"})
			continue
		}
		var rating *int
		if raw := value("Оценка"); raw != "" {
			value, err := strconv.Atoi(raw)
			if err != nil || value < 1 || value > 5 {
				preview.Errors = append(preview.Errors, RowIssue{Row: line, Message: "rating must be an integer from 1 to 5"})
				continue
			}
			rating = &value
		}
		preview.Reviews = append(preview.Reviews, marketplace.Review{
			Marketplace:       "ozon",
			ExternalReviewID:  "order:" + order + "|sku:" + sku,
			ExternalProductID: sku,
			SellerArticle:     article,
			SourceKind:        marketplace.SourceKindImported,
			SourceMethod:      marketplace.SourceMethodCSV,
			Rating:            rating,
			Text:              text,
			CreatedAtMP:       created,
		})
	}
	return preview, nil
}

func parseOzonDate(value string) (time.Time, error) {
	value = strings.TrimSpace(value)
	for _, layout := range []string{time.RFC3339, time.RFC3339Nano, "2006-01-02 15:04:05", "2006-01-02"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, fmt.Errorf("invalid date %q", value)
}

type bomReader struct {
	r       io.Reader
	checked bool
}

func (b *bomReader) Read(p []byte) (int, error) {
	if b.checked {
		return b.r.Read(p)
	}
	b.checked = true
	prefix := make([]byte, 3)
	n, err := io.ReadFull(b.r, prefix)
	if err != nil && err != io.ErrUnexpectedEOF {
		return 0, err
	}
	if n == 3 && string(prefix) == "\ufeff" {
		return b.r.Read(p)
	}
	copy(p, prefix[:n])
	return n, nil
}
