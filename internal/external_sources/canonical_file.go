package external_sources

import (
	"archive/zip"
	"bytes"
	"encoding/csv"
	"encoding/xml"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"reviews/internal/marketplace"
)

// CanonicalPreview is the normalized result of a canonical review file.
type CanonicalPreview struct {
	Reviews []InputReview
	Errors  []RowIssue
}

var canonicalColumns = []string{
	"marketplace_review_id", "provider_record_id", "external_product_id", "seller_article",
	"author_name", "rating", "title", "text", "pros", "cons", "created_at", "updated_at",
}

func ParseCanonicalCSV(r io.Reader) (CanonicalPreview, error) {
	data, err := readBounded(r, maxXLSXInput)
	if err != nil {
		return CanonicalPreview{}, fmt.Errorf("read csv: %w", err)
	}
	reader := csv.NewReader(bytes.NewReader(data))
	reader.FieldsPerRecord = -1
	reader.LazyQuotes = true
	return parseCanonicalRows(func() ([]string, error) { return reader.Read() })
}

func ParseCanonicalXLSX(r io.Reader) (CanonicalPreview, error) {
	rows, err := readCanonicalXLSXRows(r)
	if err != nil {
		return CanonicalPreview{}, err
	}
	index := 0
	return parseCanonicalRows(func() ([]string, error) {
		if index >= len(rows) {
			return nil, io.EOF
		}
		row := rows[index]
		index++
		return row, nil
	})
}

func parseCanonicalRows(next func() ([]string, error)) (CanonicalPreview, error) {
	var preview CanonicalPreview
	headers, err := next()
	if err == io.EOF {
		return preview, fmt.Errorf("canonical file has no header row")
	}
	if err != nil {
		return preview, fmt.Errorf("read header: %w", err)
	}
	columns := make(map[string]int, len(headers))
	for i, name := range headers {
		name = strings.TrimSpace(strings.TrimPrefix(name, "\ufeff"))
		if name != "" {
			columns[name] = i
		}
	}
	for _, name := range []string{"text", "created_at"} {
		if _, ok := columns[name]; !ok {
			return preview, fmt.Errorf("canonical header is missing %q", name)
		}
	}
	value := func(record []string, name string) string {
		i, ok := columns[name]
		if !ok || i >= len(record) {
			return ""
		}
		return strings.TrimSpace(record[i])
	}
	row := 1
	for {
		record, readErr := next()
		if readErr == io.EOF {
			break
		}
		row++
		if readErr != nil {
			return CanonicalPreview{}, fmt.Errorf("line %d: %w", row, readErr)
		}
		text := value(record, "text")
		createdRaw := value(record, "created_at")
		if text == "" || createdRaw == "" {
			preview.Errors = append(preview.Errors, RowIssue{Row: row, Message: "text and created_at are required"})
			continue
		}
		created, parseErr := time.Parse(time.RFC3339, createdRaw)
		if parseErr != nil {
			preview.Errors = append(preview.Errors, RowIssue{Row: row, Message: "created_at must be RFC3339"})
			continue
		}
		var updated *time.Time
		if raw := value(record, "updated_at"); raw != "" {
			parsed, parseErr := time.Parse(time.RFC3339, raw)
			if parseErr != nil {
				preview.Errors = append(preview.Errors, RowIssue{Row: row, Message: "updated_at must be RFC3339"})
				continue
			}
			updated = &parsed
		}
		var rating *int
		if raw := value(record, "rating"); raw != "" {
			number, parseErr := strconv.Atoi(raw)
			if parseErr != nil || number < 1 || number > 5 {
				preview.Errors = append(preview.Errors, RowIssue{Row: row, Message: "rating must be an integer from 1 to 5"})
				continue
			}
			rating = &number
		}
		providerID := value(record, "provider_record_id")
		if providerID == "" {
			providerID = value(record, "marketplace_review_id")
		}
		preview.Reviews = append(preview.Reviews, InputReview{Review: marketplace.Review{
			ExternalReviewID:  value(record, "marketplace_review_id"),
			ExternalProductID: value(record, "external_product_id"),
			SellerArticle:     value(record, "seller_article"),
			AuthorName:        value(record, "author_name"),
			Rating:            rating,
			Title:             value(record, "title"),
			Text:              text,
			Pros:              value(record, "pros"),
			Cons:              value(record, "cons"),
			CreatedAtMP:       created,
			UpdatedAtMP:       updated,
		}, ProviderRecordID: providerID})
	}
	return preview, nil
}

// readCanonicalXLSXRows uses the same bounded worksheet primitives as the Ozon parser.
func readCanonicalXLSXRows(r io.Reader) ([][]string, error) {
	data, err := readBounded(r, maxXLSXInput)
	if err != nil {
		return nil, fmt.Errorf("read xlsx: %w", err)
	}
	archive, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("open xlsx: %w", err)
	}
	if len(archive.File) > maxXLSXEntries {
		return nil, fmt.Errorf("xlsx has too many files")
	}
	files := make(map[string][]byte, 3)
	for _, file := range archive.File {
		if file.UncompressedSize64 > maxXLSXFile {
			return nil, fmt.Errorf("xlsx member %q is too large", file.Name)
		}
		if file.Name != "xl/worksheets/sheet1.xml" && file.Name != "xl/sharedStrings.xml" && file.Name != "xl/styles.xml" {
			continue
		}
		body, openErr := file.Open()
		if openErr != nil {
			return nil, fmt.Errorf("open %s: %w", file.Name, openErr)
		}
		contents, readErr := readBounded(body, maxXLSXFile)
		closeErr := body.Close()
		if readErr != nil {
			return nil, fmt.Errorf("read %s: %w", file.Name, readErr)
		}
		if closeErr != nil {
			return nil, fmt.Errorf("close %s: %w", file.Name, closeErr)
		}
		files[file.Name] = contents
	}
	sheet, ok := files["xl/worksheets/sheet1.xml"]
	if !ok {
		return nil, fmt.Errorf("xlsx sheet1.xml is missing")
	}
	stringsTable, err := parseSharedStrings(files["xl/sharedStrings.xml"])
	if err != nil {
		return nil, fmt.Errorf("parse shared strings: %w", err)
	}
	dateStyles, err := parseDateStyles(files["xl/styles.xml"])
	if err != nil {
		return nil, fmt.Errorf("parse styles: %w", err)
	}
	var worksheet xlsxWorksheet
	if err := xml.Unmarshal(sheet, &worksheet); err != nil {
		return nil, fmt.Errorf("parse worksheet: %w", err)
	}
	rows := make([][]string, 0, len(worksheet.Rows))
	for _, row := range worksheet.Rows {
		values := make(map[int]string, len(row.Cells))
		maxColumn := -1
		for i, cell := range row.Cells {
			column := columnIndex(cell.Ref, i)
			values[column] = strings.TrimSpace(cellText(cell, stringsTable, dateStyles))
			if column > maxColumn {
				maxColumn = column
			}
		}
		result := make([]string, maxColumn+1)
		for column, value := range values {
			result[column] = value
		}
		rows = append(rows, result)
	}
	return rows, nil
}
