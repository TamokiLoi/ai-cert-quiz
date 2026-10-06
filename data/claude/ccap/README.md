# Dữ liệu CCAP cho cert-quiz

## Phạm vi và trạng thái

Thư mục này là **nguồn câu hỏi** cho bộ CCAP, gồm `1.json` đến `5.json`. Ứng dụng hiện nằm ở `ai-cert-quiz.html`, nạp các bộ đề từ `data.json`; repo không có thư mục `src`. Bộ CCAP đã được chuyển vào `data.json` dưới ID `claude-ccap` bằng `node tools/merge-claude-ccap.js`.

| File | Số câu | `question_number` |
| --- | ---: | --- |
| `1.json` | 13 | 1–13 |
| `2.json` | 13 | 14–26 |
| `3.json` | 13 | 27–39 |
| `4.json` | 13 | 40–52 |
| `5.json` | 12 | 53–64 |

Tổng cộng **64 câu**: 38 câu một đáp án (`single`) và 26 câu nhiều đáp án (`multi`). Các file đều là JSON hợp lệ, mỗi file chứa một mảng ở cấp cao nhất. Dãy số câu liên tục, không trùng số; không thấy câu hỏi trùng nguyên văn. Trong từng câu, `result.key` đều khớp với một lựa chọn trong `answer`, và `result.text` khớp nội dung lựa chọn tương ứng. Đối chiếu bằng cách chuẩn hóa văn bản câu hỏi của ứng dụng, không có câu CCAP nào trùng với câu trong các bộ đề khác của `data.json`.

## Schema nguồn

Mỗi phần tử của mảng có các trường sau:

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `question_number` | số nguyên | Số câu duy nhất trong toàn bộ 5 file. |
| `question` | chuỗi | Nội dung câu hỏi. |
| `answer` | mảng `{ key, text }` | Các phương án trả lời. Câu `single` có 4 phương án; câu `multi` có 5. |
| `type` | `single` hoặc `multi` | Số đáp án cần chọn. |
| `result` | mảng `{ key, text }` | Các phương án đúng; 1 phần tử với `single`, 2 với `multi`. |
| `note` | chuỗi | Giải thích đáp án, có thể chứa nhiều dòng. |

`key` và `text` trong `answer` và `result` đều là chuỗi. `result` là đáp án gốc; khi chuyển sang định dạng ứng dụng, lấy **key** làm `correct`, không so khớp theo text.

## Ánh xạ sang `data.json`

`data.json` chứa phần tử `exams` có `id: "claude-ccap"`, `track: "Claude"`, `certLevel: "pro"`, `title`, `subtitle`, `source`, `count: 64`, `hasExplanation: true` và mảng `questions`. Trường `certLevel` giúp giao diện xếp bộ này vào mục Claude Pro; các bộ Claude cũ mặc định thuộc Foundations.

| JSON nguồn | Câu hỏi trong `data.json` |
| --- | --- |
| `question_number` | `id` |
| `question` | `question` |
| `answer` | `options` (giữ `{ key, text }` và thứ tự gốc) |
| `type: "single"` | `type: "single"` |
| `type: "multi"` | `type: "multiple"` |
| `result[0].key` của câu `single` | `correct` dạng chuỗi, ví dụ `"B"` |
| `result.map(x => x.key)` của câu `multi` | `correct` dạng mảng, ví dụ `["A", "C"]` |
| `note` | `explanation` |

Không có dữ liệu nguồn tương ứng cho `optExp`, `category`, `topic`, `difficulty` hoặc trích dẫn nguồn. Chỉ thêm các trường đó sau khi biên tập và kiểm chứng riêng; không suy ra từ `note` một cách tự động.

Ứng dụng đọc `data.json` (hoặc `data.js` dự phòng khi mở qua `file://`). Chạy lại `node tools/merge-claude-ccap.js` sau khi sửa nguồn để cập nhật bộ CCAP và hai tổng `totalQuestions`, `uniqueQuestions`; sau đó chạy `node tools/validate-data.js` từ gốc repo. `uniqueQuestions` được tính trên toàn bộ các bộ đề bằng cùng phép chuẩn hóa câu hỏi của ứng dụng. Nếu phân phối bản `file://`, cũng cần tạo lại `data.js` tương ứng.

## Vấn đề nội dung cần rà soát

- `2.json`, câu 18: câu hỏi có đoạn `hich two test types`, có vẻ thiếu chữ **W** đầu từ `Which`.
- `1.json`, câu 2: một phương án có `investment advicerequests`, có vẻ thiếu khoảng trắng giữa `advice` và `requests`.

Đợt kiểm tra này xác nhận cú pháp, cấu trúc và tính nhất quán nội bộ của dữ liệu. Tính đúng sai chuyên môn của 64 đáp án và phần giải thích chưa được đối chiếu với tài liệu chứng chỉ chính thức.
