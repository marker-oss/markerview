package external_sources

import (
	"archive/zip"
	"bytes"
	"io"
	"testing"
)

func TestParseOzonXLSXNormalizesRows(t *testing.T) {
	sheet := `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c></row><row><c r="A2" t="inlineStr"><is><t>A-1</t></is></c><c r="B2" t="inlineStr"><is><t>SKU-1</t></is></c><c r="C2" t="inlineStr"><is><t>Отлично</t></is></c><c r="D2" t="inlineStr"><is><t>2026-09-29T10:00:00Z</t></is></c><c r="E2" t="inlineStr"><is><t>5</t></is></c></row></sheetData></worksheet>`
	data := makeXLSXWithShared(t, sheet, `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Артикул</t></si><si><t>SKU</t></si><si><t>Текст отзыва</t></si><si><t>Дата публикации</t></si><si><t>Оценка</t></si></sst>`)
	preview, err := ParseOzonXLSX(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if len(preview.Reviews) != 1 || preview.Reviews[0].ExternalProductID != "SKU-1" {
		t.Fatalf("preview=%+v", preview)
	}
}
func makeXLSXWithShared(t *testing.T, sheet, shared string) []byte {
	t.Helper()
	var out bytes.Buffer
	zw := zip.NewWriter(&out)
	w, err := zw.Create("xl/worksheets/sheet1.xml")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = io.WriteString(w, sheet)
	w, err = zw.Create("xl/sharedStrings.xml")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = io.WriteString(w, shared)
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}
