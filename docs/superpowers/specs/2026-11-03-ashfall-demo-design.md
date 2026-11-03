# Ashfall — Demo ARPG isometric trên web (Three.js)

Ngày: 2026-11-03
Trạng thái: bản thiết kế, chờ duyệt

## 1. Mục đích và lý do

Bản demo này dùng để **đánh giá khả năng tự xây dựng một game action RPG 3D trên web**, gồm ba mảng: môi trường, nhân vật và lối chơi. Toàn bộ phần hình ảnh do người làm tự dựng, đây cũng là một phần của bài thử nghiệm. Các tính năng khác sẽ được bổ sung sau, nên kiến trúc cần đủ gọn để mở rộng tiếp.

Cảm giác mong muốn (theo yêu cầu của chủ dự án):
- **Mở đầu theo tinh thần Diablo:** dark fantasy u tối, có giọng kể thuật lại thế giới và hành trình sắp tới, ngắn gọn.
- **Chiến đấu action RPG thời gian thực:** click chuột để di chuyển và tấn công, kỹ năng gán vào phím số.
- **Camera 3D top-down isometric.**
- Người chơi được hướng dẫn làm quen với các cơ chế chiến đấu cơ bản ngay trong 5 phút đầu.

Đây là thế giới và câu chuyện **nguyên bản**, chỉ mượn tinh thần thể loại. Không sao chép tên, nhân vật, bản đồ hay giao diện đặc trưng của Diablo.

## 2. Mục tiêu

1. Chơi trọn vẹn một mạch: Màn hình tiêu đề → Đoạn mở đầu → Map 1 (có hướng dẫn) → Map 2 (có boss) → Màn hình kết thúc demo. Thời lượng khoảng 10–15 phút.
2. Môi trường isometric có không khí: ánh sáng tối, sương mù, bóng đổ, ánh đuốc, hạt tro bay.
3. Nhân vật và quái dựng bằng code, có hoạt cảnh đi, đánh, trúng đòn, chết.
4. Chiến đấu có "cảm giác đánh": hit-flash, khựng hình ngắn (hit-stop), rung camera nhẹ, số sát thương bay lên, hạt máu/tro.
5. Chạy mượt (mục tiêu 60fps) trên laptop tầm trung, Chrome bản mới.

## 3. Không làm trong demo (non-goals)

- Kho đồ, trang bị, rơi đồ ngẫu nhiên (chỉ có bình máu rơi ra)
- Cây kỹ năng, nhiều lớp nhân vật, chọn nhân vật
- Lưu game, multiplayer, server
- Hỗ trợ điện thoại hoặc tay cầm, chỉ chơi bằng chuột và bàn phím trên desktop
- Lồng tiếng và âm nhạc (phần âm thanh là mục mở rộng, xem mục 10)
- Asset 3D tải từ bên ngoài: không dùng model hay texture có sẵn trên mạng

## 4. Thất bại dù vẫn "chạy được" (anti-goals)

- Trông như các khối hộp trên nền xám, không có không khí
- Chiến đấu "đánh vào không khí": không có phản hồi khi trúng đòn
- Click để di chuyển mà nhân vật kẹt vào tường hoặc đi xuyên vật cản
- Đoạn mở đầu dài lê thê và không cho bỏ qua
- Code dồn hết vào một file khổng lồ, không mở rộng tiếp được

## 5. Thế giới và câu chuyện (lựa chọn của người làm, có thể sửa)

**Bối cảnh:** Vương quốc Valemor từng được bảo vệ bởi **Ngọn Lửa Vĩnh Hằng** đặt trên đỉnh tháp Sanctum. Ba mươi năm trước, ngọn lửa tắt sau một đêm không ai giải thích được. Từ đó tro xám rơi không ngừng, người chết không còn nằm yên, và một thế lực dưới lòng đất được gọi là **Kẻ Than Hồng** (The Smoldering One) bắt đầu thức giấc.

**Người chơi:** một **Lữ Khách** (chiến binh cận chiến), người cuối cùng mang trong mình một tia lửa còn sót lại. Người chơi tìm về **Làng Emberfall**, ngôi làng nằm ở rìa vùng tro tàn.

**Đoạn mở đầu (khoảng 60–90 giây, bỏ qua được bằng Space hoặc Esc):**
Camera lướt chậm qua 3–4 khung cảnh 3D dựng bằng chính engine của game: tháp Sanctum với ngọn lửa đã tắt, cánh đồng tro, nghĩa địa có xác chết trồi lên, bóng người lữ khách đứng ở cổng làng. Chữ chạy hiện dần từng dòng (giọng kể dạng chữ), kiểu như:

> "Từng có một ngọn lửa không bao giờ tắt..."
> "...cho đến đêm nó tắt."
> "Ba mươi năm tro rơi. Người chết đứng dậy. Và dưới Hầm Mộ Cổ, có thứ gì đó đang thở."
> "Ngươi mang tia lửa cuối cùng. Hãy đến Emberfall."

Câu chữ cuối cùng sẽ được viết lại trong lúc làm. Ở trên chỉ là định hướng giọng văn.

**Map 1 — Làng Emberfall (vừa là map hướng dẫn):**
- Làng đổ nát, có hàng rào gỗ, vài căn nhà cháy dở, đống lửa trại ở giữa, đuốc dọc đường đi, cây khô, mộ bia.
- NPC **Trưởng Lão Maren** đứng cạnh đống lửa, giao nhiệm vụ: dọn sạch xác sống ở nghĩa địa phía đông rồi đi xuống Hầm Mộ.
- Hướng dẫn được lồng vào map theo từng bước, mỗi bước chỉ mở sau khi người chơi làm xong bước trước (xem mục 7).
- Cuối map là lối xuống Hầm Mộ, chỉ mở sau khi dọn xong nghĩa địa.

**Map 2 — Hầm Mộ Cổ:**
- Hầm mộ dưới lòng đất gồm các phòng nối nhau bằng hành lang. Có cột đá, quan tài, xương, nến, chậu lửa, mạng nhện, và ánh sáng xanh lạnh xen lẫn ánh lửa.
- Có nhiều loại quái hơn, kể cả quái đánh xa.
- Phòng cuối có boss **Kẻ Gác Mộ** (The Barrow Warden). Hạ boss xong thì hiện màn hình "Kết thúc demo" kèm thống kê (thời gian chơi, số quái đã hạ).

## 6. Lối chơi

### Điều khiển
| Thao tác | Tác dụng |
|---|---|
| Click chuột trái lên mặt đất | Đi tới điểm đó (có tìm đường né vật cản) |
| Giữ chuột trái | Nhân vật liên tục đi theo con trỏ |
| Click chuột trái lên quái | Tiến lại gần và đánh thường, giữ chuột để đánh liên tục |
| Phím 1–3 | Dùng kỹ năng, hướng về phía con trỏ chuột |
| Phím Q | Uống bình máu |
| Space hoặc Esc | Bỏ qua đoạn kể chuyện hoặc hội thoại; Esc mở menu tạm dừng |
| Rê chuột lên quái | Viền sáng quái đó và hiện thanh máu cùng tên quái ở trên đầu màn hình |

### Chỉ số nhân vật
- **Máu (HP)** và **Nộ (Fury)**. Nộ tăng khi đánh thường trúng và tự giảm dần khi không chiến đấu. Kỹ năng tiêu tốn Nộ.
  *Lý do chọn:* bắt người chơi phải đánh thường để có Nộ, từ đó dạy được nhịp chiến đấu.
- **Cấp độ đơn giản:** hạ quái được XP, lên cấp thì tăng máu và sát thương, có hiệu ứng ánh sáng. Tối đa khoảng cấp 5 trong demo.
- Chết thì hồi sinh ở điểm checkpoint gần nhất (đầu map hoặc trước cửa phòng boss), quái đã hạ không hồi lại.

### Kỹ năng của Lữ Khách
| Phím | Tên | Tác dụng | Chi phí / hồi chiêu |
|---|---|---|---|
| Chuột trái | Đánh thường | Chém một mục tiêu, nhận Nộ | — |
| 1 | Chém Xoáy (Cleave) | Chém vòng cung phía trước, trúng nhiều quái | 20 Nộ |
| 2 | Lao Tới (Charge) | Lao tới vị trí con trỏ, gây sát thương và đẩy lùi quái trên đường đi | 15 Nộ, hồi 6 giây |
| 3 | Bùng Lửa (Ember Nova) | Vòng lửa nổ ra quanh người, gây bỏng | 40 Nộ, hồi 12 giây |
| Q | Bình máu | Hồi 40% máu | Có số lượng hạn chế, nhặt thêm từ quái |

Kỹ năng 3 chỉ mở ở Map 2. Đây cũng là khoảnh khắc "nhận được sức mạnh của tia lửa".

### Quái
| Quái | Map | Hành vi |
|---|---|---|
| Xác Sống (Husk) | 1, 2 | Chậm, cận chiến, thường đi theo bầy |
| Chó Tro (Ash Hound) | 1, 2 | Nhanh, lao tới cắn rồi lùi lại |
| Xương Cung (Bone Archer) | 2 | Giữ khoảng cách và bắn tên, có vạch báo hướng bắn |
| Kẻ Gác Mộ (boss) | 2 | To lớn, có 3 đòn: đập đất (vùng đỏ báo trước rồi nổ), quét ngang, gọi Xác Sống. Dưới 50% máu thì đánh nhanh hơn |

Mọi đòn mạnh của quái đều có **dấu hiệu báo trước** (vùng đỏ hiện trên mặt đất hoặc tư thế vung tay) để người chơi có thể né.

## 7. Hướng dẫn trong Map 1

Hướng dẫn được lồng vào chuyện, các bước kế tiếp nhau, mỗi bước có khung chữ ngắn ở góc màn hình:
1. "Click vào mặt đất để di chuyển", đi tới chỗ Trưởng Lão.
2. Nói chuyện với Trưởng Lão (click vào NPC), hội thoại ngắn giới thiệu nhiệm vụ.
3. "Click vào kẻ địch để tấn công": gặp 1 Xác Sống đơn lẻ.
4. "Đánh thường để tích Nộ. Nhấn 1 để Chém Xoáy": gặp nhóm 3 Xác Sống.
5. "Nhấn 2 để Lao Tới": gặp Chó Tro đứng xa.
6. "Nhấn Q để uống bình máu": đến bước này chắc chắn người chơi đã mất máu. Nếu chưa mất máu thì bỏ qua bước này.
7. Dọn sạch nghĩa địa (khoảng 8–10 quái), cổng Hầm Mộ mở ra.

Có cài sẵn một tùy chọn tắt hướng dẫn trong menu tạm dừng.

## 8. Hình ảnh

- **Camera:** OrthographicCamera kiểu isometric (xoay 45°, nghiêng khoảng 35°), đi theo nhân vật có làm mượt. Cho phép zoom nhẹ bằng con lăn chuột trong một khoảng giới hạn.
- **Phong cách:** low-poly, flat shading. Màu chủ đạo xám tro, nâu đất, cam lửa. Map 2 thêm xanh lạnh.
- **Ánh sáng:** ánh trăng mờ (directional light có đổ bóng), PointLight cho đuốc và lửa trại có nhấp nháy, nhân vật mang theo một nguồn sáng ấm nhỏ.
  Cần giới hạn số PointLight hoạt động cùng lúc, chỉ bật các nguồn gần camera.
- **Hậu kỳ:** bloom cho lửa và kỹ năng, vignette, chỉnh màu nhẹ.
- **Hạt (particles):** tro rơi khắp nơi, tia lửa từ đuốc, máu hoặc bụi khi trúng đòn, vệt chém, vòng lửa của Ember Nova.
- **Nhân vật và quái:** dựng từ các khối hình học (thân, đầu, tay, chân, vũ khí) gắn theo dạng cây cha con. Hoạt cảnh tạo bằng code, dùng sóng sin và đường cong easing cho đi bộ, đứng thở, vung đòn, trúng đòn, chết (gục xuống hoặc vỡ ra).
  Đây là điểm yếu đã biết trước: chuyển động sẽ thô hơn hoạt hình chuyên nghiệp, bù lại bằng cách làm thật đã ở tư thế (pose) và easing.
- **Map:** dựng bằng code từ một bản mô tả dữ liệu (lưới ô có loại nền, vật cản, vị trí đặt đồ trang trí, quái và điểm kích hoạt). Đồ trang trí lặp lại nhiều dùng InstancedMesh.
- **Giao diện (HUD):** HTML/CSS đè lên canvas gồm quả cầu máu và quả cầu Nộ ở hai góc dưới, thanh kỹ năng có hiển thị hồi chiêu ở giữa, thanh XP, khung hội thoại, khung hướng dẫn, thanh máu boss.
  Font chữ kiểu serif cổ, **bắt buộc hỗ trợ đầy đủ dấu tiếng Việt** (ví dụ Cormorant Garamond cho tiêu đề và đoạn kể, Noto Serif cho chữ nhỏ). Tải từ Google Fonts là chấp nhận được vì đây là font, không phải asset 3D.

## 9. Công nghệ và ràng buộc

- TypeScript + Three.js + Vite. Không dùng engine vật lý: va chạm dùng hình tròn trên mặt phẳng XZ cộng với lưới ô vật cản.
- Tìm đường: A* trên lưới ô của map, có làm mượt đường đi.
- Chạy hoàn toàn phía client. `npm run dev` để phát triển, `npm run build` ra thư mục tĩnh deploy được lên bất kỳ host tĩnh nào.
- Desktop, Chrome/Edge/Firefox bản mới, WebGL2.
- Logic thuần (tìm đường, công thức sát thương, máy trạng thái AI, tiến trình hướng dẫn) có unit test bằng Vitest. Phần hình ảnh được kiểm tra bằng cách chạy game và chụp màn hình.

## 10. Mở rộng nếu còn thời gian (không bắt buộc cho demo)

- Hiệu ứng âm thanh tổng hợp bằng WebAudio (tiếng chém, trúng đòn, lửa), không dùng file âm thanh ngoài
- Rơi vàng hoặc đồ đơn giản
- Minimap

## 11. Quyết định bổ sung

**Chủ dự án đã chốt:**
- **Ngôn ngữ:** toàn bộ chữ trong game (đoạn kể, hội thoại, hướng dẫn, giao diện) viết bằng **tiếng Việt**. Tên riêng giữ kiểu fantasy (Valemor, Emberfall, Maren). Không cần nút chuyển ngôn ngữ, nhưng gom hết chữ vào một file `strings` riêng để sau này dịch được.
- **Máy chạy thử:** **MacBook Apple Silicon**, đồ họa tích hợp. Mức đồ họa mặc định phải đạt khoảng 60fps trên máy này.

**Người làm tự chốt (có thể sửa):**
- **Hiệu năng:** giới hạn pixel ratio ở mức tối đa 1.5–2. Có 2 mức chất lượng là *Cao* (mặc định) và *Thấp* (tắt bloom, giảm bóng đổ, giảm hạt), chọn trong menu tạm dừng. Tối đa khoảng 4–6 PointLight hoạt động cùng lúc, chỉ bật những nguồn gần camera. Chỉ ánh trăng mới đổ bóng.
- **Thư viện:** chỉ dùng `three` và các addon chính chủ đi kèm (`EffectComposer`, `UnrealBloomPass`, `OutputPass`...). Tìm đường A*, AI, tween, quản lý trạng thái và UI tự viết, không dùng framework UI. Dev dùng Vite, Vitest, TypeScript.
- **Chuẩn bị cho mở rộng sau này:** chỉ số nhân vật, kỹ năng, quái và map mô tả bằng dữ liệu (object/JSON trong TS), không hard-code riêng cho Lữ Khách. Tách logic game khỏi phần hiển thị: logic không import `three` ở những chỗ không cần. Không làm lưu game, nhưng trạng thái người chơi giữ ở dạng object thuần để sau này lưu được.
- **Thứ tự làm:** dựng mạch chơi xuyên suốt ở mức thô trước (tiêu đề → mở đầu → map 1 → map 2 → kết thúc), sau đó mới đánh bóng hình ảnh và cảm giác đánh.
- **Duyệt hình ảnh:** chủ dự án là người duyệt. Có 2 mốc gửi ảnh chụp và bản chạy được: (1) sau khi xong môi trường và nhân vật của Map 1, (2) sau khi xong Map 2 và boss. Cần chốt hướng hình ảnh ở mốc 1 trước khi làm tiếp.
- **Bàn giao:** bản chạy được (`npm run dev` / `npm run build`) cùng README ngắn gồm cách chạy, điều khiển, kiến trúc code, và ghi chú những gì đã làm được, chỗ khó, đề xuất cho bản đầy đủ.

## 12. Để người làm tự quyết

- Cấu trúc thư mục và kiến trúc code (ECS hay hướng đối tượng), miễn là chia module rõ ràng
- Con số cân bằng cụ thể (máu, sát thương, tốc độ)
- Bố cục chi tiết của từng map
- Câu chữ cuối cùng của đoạn mở đầu và hội thoại, giữ đúng giọng văn và cốt truyện ở mục 5
