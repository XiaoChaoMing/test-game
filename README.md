# Ashfall — Demo ARPG isometric trên web

Bản demo action RPG dark fantasy, góc nhìn 3D isometric, chạy trên trình duyệt bằng **Three.js**. Toàn bộ hình ảnh (địa hình, nhà cửa, nhân vật, quái, hiệu ứng, icon kỹ năng) được dựng bằng code, không dùng model hay texture tải từ ngoài.

## Chạy game

```bash
npm install
npm run dev        # mở http://localhost:5173
npm run build      # build tĩnh ra dist/, deploy lên host tĩnh bất kỳ
npm test           # 51 unit test cho phần logic
```

Yêu cầu: Chrome, Edge hoặc Firefox bản mới (WebGL2), chơi bằng chuột và bàn phím trên desktop.

## Điều khiển

| Thao tác | Tác dụng |
|---|---|
| Chuột trái lên mặt đất | Di chuyển (tự tìm đường). Giữ chuột để đi theo con trỏ |
| Chuột trái lên quái | Tiến lại gần và đánh. Giữ chuột để đánh liên tục |
| Chuột trái lên NPC | Nói chuyện |
| `1` | Chém Xoáy: chém vòng cung, 20 Nộ |
| `2` | Lao Tới: lao về phía con trỏ, 15 Nộ, hồi 6 giây |
| `3` | Bùng Lửa: vòng lửa quanh người, 40 Nộ, hồi 12 giây (mở khoá ở bệ thờ trong Hầm Mộ) |
| `Q` | Uống bình máu (hồi 40% máu) |
| Con lăn chuột | Phóng to / thu nhỏ |
| `Esc` | Menu tạm dừng: chỉnh đồ hoạ Cao/Thấp, bật/tắt hướng dẫn, chơi lại màn |
| `Space` / `Esc` | Bỏ qua đoạn mở đầu. Khi đang hội thoại, `Space` để qua câu tiếp theo |

## Nội dung demo

1. **Màn hình tiêu đề**: đống lửa trại giữa tro bay.
2. **Đoạn mở đầu** dài khoảng 70 giây, gồm 4 cảnh dựng bằng engine của game: tháp Sanctum với ngọn lửa tắt dần, cánh đồng tro, xác chết trồi lên khỏi mộ, Lữ Khách đi về Emberfall. Lời kể chạy dạng chữ.
3. **Map 1, Làng Emberfall**, kiêm phần hướng dẫn 7 bước: di chuyển, nói chuyện với Trưởng Lão Maren, đánh thường, Chém Xoáy, Lao Tới, uống bình máu, dọn sạch nghĩa địa để phá phong ấn cổng Hầm Mộ.
4. **Map 2, Hầm Mộ Cổ**: các phòng nối nhau có Xác Sống, Chó Tro và Xương Cung (bắn tên, có vạch báo hướng bắn). Bệ thờ mở khoá kỹ năng Bùng Lửa. Phòng cuối là boss **Kẻ Gác Mộ** với 3 đòn đập đất, quét ngang, gọi quái; mọi đòn đều có vùng đỏ báo trước. Dưới 50% máu boss nổi giận và đánh nhanh hơn.
5. **Màn hình kết thúc** hiển thị thời gian chơi, số quái đã hạ, cấp đạt được và số lần ngã xuống.

Chết sẽ hồi sinh ở điểm checkpoint gần nhất. Quái đã hạ không hồi lại. Nếu chết trong trận boss, boss hồi đầy máu.

### Tham số dành cho dev (chỉ có ở `npm run dev`)

- `?level=emberfall` hoặc `?level=crypt`: vào thẳng một map
- `?at=x,z`: đặt vị trí xuất phát
- `?intro`: xem thẳng đoạn mở đầu
- `?rigs`: xem toàn bộ nhân vật và hoạt cảnh
- `?stats`: hiện FPS và số draw call
- `?q=low`: đồ hoạ Thấp

## Kiến trúc code

```
src/
  core/      vòng lặp game (dt bị chặn tối đa 0.1s), input, event bus, RNG
  data/      dữ liệu thuần: chỉ số, kỹ năng, quái, map, toàn bộ chữ tiếng Việt (strings.ts)
  logic/     luật chơi, KHÔNG import three: lưới, A*, va chạm, sát thương, Nộ,
             hồi chiêu, lên cấp, AI quái, AI boss, các bước hướng dẫn  ← có unit test
  render/    renderer + hậu kỳ (bloom, vignette), camera isometric, ánh sáng
             (LightPool chỉ bật N đèn gần nhất), địa hình, props, nhân vật + animator, hạt, hiệu ứng
  game/      nối logic với hình ảnh: Actor, World, các controller (người chơi, quái, boss),
             hệ thống chiến đấu, kỹ năng, đạn, vật phẩm, kịch bản map (level-flow)
  ui/        HUD (HTML/CSS), số sát thương bay lên, hội thoại, hướng dẫn, menu
  scenes/    tiêu đề, mở đầu, màn chơi, kết thúc, bộ dựng cảnh điện ảnh
tests/       Vitest cho src/logic
```

Các nguyên tắc chính:
- **Logic tách khỏi hiển thị.** AI và luật chơi chỉ trả về ý định (đi đâu, đánh lúc nào). Phần `game/` thực thi ý định đó, nên test được mà không cần WebGL.
- **Mọi thứ đều là dữ liệu.** Thêm quái, kỹ năng hay map mới chủ yếu là thêm dữ liệu trong `data/`.
- **Map dựng bằng code.** Lưới ô được sinh từ hàm (vẽ đường, đặt phòng), props đặt theo danh sách. Toàn bộ mesh tĩnh được gộp theo material, nên cả map chỉ tốn vài chục draw call.
- **Tường và vách đá phía gần camera luôn thấp**, để không bao giờ che mất nhân vật.

## Hiệu năng

Đo trên MacBook Apple Silicon (M4), Chrome, độ phân giải 1440×900, đồ hoạ Cao:
- Cả 3 khu vực đã đo (làng, nghĩa địa có 14 quái, đại sảnh Hầm Mộ) đều đạt 60fps.
- CPU tốn khoảng 2,5ms mỗi khung hình. Số draw call từ khoảng 300 (làng) đến khoảng 900 (nghĩa địa).

Mức đồ hoạ Thấp tắt bloom, giảm bóng đổ, chỉ dùng 3 đèn và một nửa số hạt.

## Đánh giá sau demo

**Đã làm được**
- Một mạch chơi trọn vẹn khoảng 10–15 phút, từ tiêu đề tới màn kết thúc.
- Chiến đấu có cảm giác đánh: chớp trắng khi trúng đòn, khựng hình ngắn, rung camera, số sát thương bay lên, máu và tia lửa văng ra, đẩy lùi.
- Ánh sáng nhiều nguồn (đuốc, lửa trại, chậu lửa) mà chi phí vẫn cố định nhờ LightPool.
- Boss có vùng báo trước đòn đánh, gọi quái và giai đoạn nổi giận.

**Chỗ khó / điểm yếu đã biết**
- **Hoạt cảnh tạo bằng code** dùng keyframe, sóng sin và easing, nên đọc được nhưng vẫn cứng hơn hoạt hình làm tay. Đây là giới hạn lớn nhất về mặt hình ảnh.
- **Nhân vật dựng từ khối hình học** nên số draw call tăng theo số quái, vì mỗi khớp là một mesh. Với bản đầy đủ nên dùng SkinnedMesh với một mesh cho mỗi nhân vật, hoặc gộp geometry theo khớp.
- **Kiểm thử hình ảnh** mới dừng ở chạy game và chụp ảnh. Chưa có test hồi quy hình ảnh tự động.

**Đề xuất cho bản đầy đủ**
1. Chuyển nhân vật sang model rigged (glTF + SkinnedMesh) và dùng AnimationMixer. Có thể giữ animator hiện tại cho hiệu ứng phụ như giật khi trúng đòn hay thở.
2. Thêm hệ thống đồ (loot), kho đồ và lưu game. Trạng thái người chơi (`PlayerState`) đã là dữ liệu thuần, nên sẵn sàng để lưu.
3. Thêm âm thanh bằng WebAudio, gồm tiếng chém, tiếng trúng đòn, nhạc nền theo map.
4. Làm trình chỉnh sửa map đơn giản, xuất ra đúng định dạng `MapDef`.
5. Làm mờ những vật thể che nhân vật, để có thể dùng tường cao ở mọi phía.
