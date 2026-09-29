package external_sources

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"time"

	"reviews/internal/marketplace"
)

const (
	maxXLSXInput   = 20 << 20
	maxXLSXFile    = 8 << 20
	maxXLSXEntries = 512
)

type xlsxWorksheet struct {
	Rows []xlsxRow `xml:"sheetData>row"`
}
type xlsxRow struct {
	Cells []xlsxCell `xml:"c"`
}
type xlsxCell struct {
	Ref    string `xml:"r,attr"`
	Type   string `xml:"t,attr"`
	Style  int    `xml:"s,attr"`
	Value  string `xml:"v"`
	Inline string `xml:"is>t"`
}

func ParseOzonXLSX(r io.Reader) (Preview, error) {
	data, err := readBounded(r, maxXLSXInput)
	if err != nil {
		return Preview{}, fmt.Errorf("read xlsx: %w", err)
	}
	archive, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return Preview{}, fmt.Errorf("open xlsx: %w", err)
	}
	if len(archive.File) > maxXLSXEntries {
		return Preview{}, fmt.Errorf("xlsx has too many files")
	}
	files := make(map[string][]byte, 3)
	for _, file := range archive.File {
		if file.UncompressedSize64 > maxXLSXFile {
			return Preview{}, fmt.Errorf("xlsx member %q is too large", file.Name)
		}
		if file.Name != "xl/worksheets/sheet1.xml" && file.Name != "xl/sharedStrings.xml" && file.Name != "xl/styles.xml" {
			continue
		}
		body, openErr := file.Open()
		if openErr != nil {
			return Preview{}, fmt.Errorf("open %s: %w", file.Name, openErr)
		}
		contents, readErr := readBounded(body, maxXLSXFile)
		closeErr := body.Close()
		if readErr != nil {
			return Preview{}, fmt.Errorf("read %s: %w", file.Name, readErr)
		}
		if closeErr != nil {
			return Preview{}, fmt.Errorf("close %s: %w", file.Name, closeErr)
		}
		files[file.Name] = contents
	}
	sheet, ok := files["xl/worksheets/sheet1.xml"]
	if !ok {
		return Preview{}, fmt.Errorf("xlsx sheet1.xml is missing")
	}
	stringsTable, err := parseSharedStrings(files["xl/sharedStrings.xml"])
	if err != nil {
		return Preview{}, fmt.Errorf("parse shared strings: %w", err)
	}
	dateStyles, err := parseDateStyles(files["xl/styles.xml"])
	if err != nil {
		return Preview{}, fmt.Errorf("parse styles: %w", err)
	}
	var worksheet xlsxWorksheet
	if err := xml.Unmarshal(sheet, &worksheet); err != nil {
		return Preview{}, fmt.Errorf("parse worksheet: %w", err)
	}
	if len(worksheet.Rows) < 1 {
		return Preview{}, fmt.Errorf("xlsx has no header row")
	}
	headers := make(map[string]int)
	for index, cell := range worksheet.Rows[0].Cells {
		headers[strings.TrimSpace(cellText(cell, stringsTable, dateStyles))] = columnIndex(cell.Ref, index)
	}
	for _, name := range []string{"Артикул", "SKU", "Текст отзыва", "Дата публикации"} {
		if _, ok := headers[name]; !ok {
			return Preview{}, fmt.Errorf("xlsx header is missing %q", name)
		}
	}
	var preview Preview
	for rowIndex, row := range worksheet.Rows[1:] {
		values := make(map[int]string, len(row.Cells))
		for index, cell := range row.Cells {
			values[columnIndex(cell.Ref, index)] = strings.TrimSpace(cellText(cell, stringsTable, dateStyles))
		}
		value := func(name string) string { return values[headers[name]] }
		article, sku, order, text := value("Артикул"), value("SKU"), value("Номер заказа"), value("Текст отзыва")
		if article == "" || sku == "" || text == "" {
			preview.Errors = append(preview.Errors, RowIssue{Row: rowIndex + 2, Message: "article, SKU, and text are required"})
			continue
		}
		dateValue := value("Дата публикации")
		if serial, parseErr := strconv.ParseFloat(dateValue, 64); parseErr == nil && serial >= 0 {
			dateValue = excelDate(serial).Format(time.RFC3339)
		}
		date, dateErr := parseOzonDate(dateValue)
		if dateErr != nil {
			preview.Errors = append(preview.Errors, RowIssue{Row: rowIndex + 2, Message: "invalid publication date"})
			continue
		}
		if order == "" {
			order = "sku:" + sku + "|article:" + article + "|date:" + date.UTC().Format(time.RFC3339Nano)
		}
		var rating *int
		if raw := value("Оценка"); raw != "" {
			number, scanErr := strconv.Atoi(raw)
			if scanErr != nil || number < 1 || number > 5 {
				preview.Errors = append(preview.Errors, RowIssue{Row: rowIndex + 2, Message: "rating must be an integer from 1 to 5"})
				continue
			}
			rating = &number
		}
		preview.Reviews = append(preview.Reviews, marketplace.Review{Marketplace: "ozon", ExternalReviewID: "order:" + order + "|sku:" + sku, ExternalProductID: sku, SellerArticle: article, SourceKind: marketplace.SourceKindImported, SourceMethod: marketplace.SourceMethodXLSX, Rating: rating, Text: text, CreatedAtMP: date})
	}
	return preview, nil
}

func readBounded(r io.Reader, max int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(r, max+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > max {
		return nil, fmt.Errorf("input exceeds %d bytes", max)
	}
	return data, nil
}

func parseSharedStrings(data []byte) ([]string, error) {
	if len(data) == 0 {
		return nil, nil
	}
	decoder := xml.NewDecoder(bytes.NewReader(data))
	var result []string
	var current strings.Builder
	insideItem := false
	for {
		token, err := decoder.Token()
		if err == io.EOF {
			return result, nil
		}
		if err != nil {
			return nil, err
		}
		switch value := token.(type) {
		case xml.StartElement:
			if value.Name.Local == "si" {
				insideItem = true
				current.Reset()
			}
			if insideItem && value.Name.Local == "t" {
				var text string
				if err := decoder.DecodeElement(&text, &value); err != nil {
					return nil, err
				}
				current.WriteString(text)
			}
		case xml.EndElement:
			if value.Name.Local == "si" && insideItem {
				result = append(result, current.String())
				insideItem = false
			}
		}
	}
}

func parseDateStyles(data []byte) (map[int]bool, error) {
	result := map[int]bool{}
	if len(data) == 0 {
		return result, nil
	}
	var doc struct {
		NumFmts struct {
			Formats []struct {
				ID   int    `xml:"numFmtId,attr"`
				Code string `xml:"formatCode,attr"`
			} `xml:"numFmt"`
		} `xml:"numFmts"`
		CellXfs struct {
			Xfs []struct {
				NumFmtID int `xml:"numFmtId,attr"`
			} `xml:"xf"`
		} `xml:"cellXfs"`
	}
	if err := xml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	custom := map[int]bool{}
	for _, format := range doc.NumFmts.Formats {
		code := strings.ToLower(format.Code)
		custom[format.ID] = strings.ContainsAny(code, "dmy")
	}
	for index, xf := range doc.CellXfs.Xfs {
		result[index] = xf.NumFmtID >= 14 && xf.NumFmtID <= 22 || custom[xf.NumFmtID]
	}
	return result, nil
}

func columnIndex(ref string, fallback int) int {
	ref = strings.TrimSpace(ref)
	if ref == "" {
		return fallback
	}
	index := 0
	for _, char := range ref {
		if char < 'A' || char > 'Z' {
			break
		}
		index = index*26 + int(char-'A'+1)
	}
	if index == 0 {
		return fallback
	}
	return index - 1
}

func cellText(cell xlsxCell, stringsTable []string, dateStyles map[int]bool) string {
	if cell.Type == "inlineStr" {
		return cell.Inline
	}
	if cell.Type == "s" {
		index, err := strconv.Atoi(strings.TrimSpace(cell.Value))
		if err == nil && index >= 0 && index < len(stringsTable) {
			return stringsTable[index]
		}
		return ""
	}
	if dateStyles[cell.Style] {
		serial, err := strconv.ParseFloat(strings.TrimSpace(cell.Value), 64)
		if err == nil && serial >= 0 && serial < 300000 {
			return excelDate(serial).Format(time.RFC3339)
		}
	}
	return cell.Value
}

func excelDate(serial float64) time.Time {
	whole, fraction := math.Modf(serial)
	return time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC).AddDate(0, 0, int(whole)).Add(time.Duration(fraction * float64(24*time.Hour)))
}
