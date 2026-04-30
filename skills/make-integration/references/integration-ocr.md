# Make Integration OCR Reference

## Capability

Make Integration OCR provides structured recognition for common bills and invoices. It supports value-added tax invoices, digital invoices, train tickets, taxi tickets, medical bills, hotel bills, catering bills, and similar voucher documents.

The current CLI entrypoint is:

```bash
makecli integration ocr -f <file> [flags]
```

## makecli Address Resolution

Do not build OCR HTTP requests manually. This capability is used only through `makecli integration ocr`, and makecli is responsible for resolving the request address, credentials, headers, multipart upload, and OCR route.

If makecli cannot authenticate, cannot reach the configured environment, or OCR returns an error, the correct next step is to fix makecli profile/configuration/environment and retry. Do not replace this capability with any non-makecli recognition path.

Use the selected makecli profile as the source of the request base URL:

```bash
makecli configure get server-url --profile <profile>
makecli integration ocr -f <file> --profile <profile>
```

If makecli connectivity works for the selected profile, this OCR capability can use the same profile. If a different environment is needed temporarily, prefer makecli configuration; use the command's `--server-url` flag only as an explicit override.

## Supported Files

- `.pdf`
- `.ofd`
- `.png`
- `.jpg`
- `.jpeg`

## Parameter Mapping

| makecli flag | API location | API field | Type | Notes |
| --- | --- | --- | --- | --- |
| `-f, --file` | multipart | `file` | file | Required local voucher file |
| `--business-id` | multipart | `business_id` | int64 | Optional business document ID |
| `--verify-vat` | multipart | `verify_vat` | bool | Optional invoice authenticity verification, server default is `true` |
| `--pages` | query | `specific_pages` | string | Examples: `"1,3,2"` or `"2-4"` |
| `--coord-restore-original` | query | `coord_restore=1` | int | Return coordinates against the original image |
| `--crop-complete` | query | `crop_complete_image=1` | int | Include base64 bill crop images |
| `--crop-value` | query | `crop_value_image=1` | int | Include base64 value crop images |
| `--merge-elec` | query | `merge_digital_elec_invoice=1` | int | Merge multi-page digital electronic invoices |
| `--return-ppi` | query | `return_ppi=1` | int | Return PDF decoding PPI |
| `--output=json` | CLI only | none | string | Useful for automation and field extraction |
| `--output=table` | CLI only | none | string | Human-readable terminal output |

## Response Shape

The Make Integration service returns the OCR result in the response `data` field:

```json
{
  "code": 200,
  "msg": "success",
  "request_id": "<request-id>",
  "data": {
    "task_id": "<task-id>",
    "status": "COMPLETED",
    "provider": "textin",
    "verify_vat": true,
    "file_name": "invoice.pdf",
    "file_type": "pdf",
    "file_size": 79265,
    "bill_count": 1,
    "processing_duration_ms": 779,
    "result": {
      "pages": [
        {
          "page_number": 0,
          "bills": [
            {
              "type": "vat_digital_invoice",
              "type_description": "数电票(增值税专用发票/普通发票)",
              "items": [
                {
                  "key": "vat_invoice_number",
                  "label": "发票号码",
                  "value": "<masked-invoice-number>",
                  "position": [0, 0, 0, 0, 0, 0, 0, 0]
                }
              ],
              "stamps": [],
              "qr_codes": []
            }
          ]
        }
      ]
    }
  }
}
```

`makecli` JSON output wraps the response data as:

```json
{
  "data": {}
}
```

## Field Extraction

For automation, extract fields from:

```text
data.result.pages[].bills[].items[]
```

Each item usually contains:

- `key`: stable field key
- `label`: Chinese display label
- `value`: recognized value
- `position`: text coordinates

Related data:

- `data.result.pages[].bills[].stamps[]`
- `data.result.pages[].bills[].qr_codes[]`

## Notes

- Page numbers are zero-based in the response.
- OCR can return empty values for unsupported or absent fields; ignore empty `value` fields in normal summaries.
- Base64 crop image fields can be large; keep them out of normal summaries.
- Mask real invoice numbers, taxpayer IDs, order numbers, phone numbers, addresses, QR payloads, tokens, and similar sensitive values in documentation examples.
- Some configured environments may not expose OCR; use the server URL configured in makecli and confirm deployment when the service is missing.
- This skill's recognition source is makecli only. No visual inspection, model-based extraction, file parsing, alternate OCR tool, direct HTTP call, inference, correction, completion, or other non-makecli fallback is allowed.
