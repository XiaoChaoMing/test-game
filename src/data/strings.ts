export const STRINGS: Record<string, string> = {
  // ---- title / menus
  'game.title': 'ASHFALL',
  'game.subtitle': 'Tro Tàn Valemor',
  'title.start': 'Nhấn chuột hoặc phím bất kỳ để bắt đầu',
  'title.demo': 'Bản demo',
  'intro.skip': 'Space / Esc — bỏ qua',
  'pause.title': 'Tạm dừng',
  'pause.resume': 'Tiếp tục',
  'pause.quality': 'Đồ hoạ: {q}',
  'pause.quality.high': 'Cao',
  'pause.quality.low': 'Thấp',
  'pause.tutorial': 'Hướng dẫn: {s}',
  'pause.on': 'Bật',
  'pause.off': 'Tắt',
  'pause.restart': 'Chơi lại màn này',
  'pause.controls': 'Chuột trái: di chuyển / tấn công · 1-2-3: kỹ năng · Q: bình máu · Esc: tạm dừng',

  // ---- intro narration (4 shots)
  'intro.1.a': 'Từng có một ngọn lửa không bao giờ tắt.',
  'intro.1.b': 'Trên đỉnh tháp Sanctum, Ngọn Lửa Vĩnh Hằng canh giữ Valemor suốt một nghìn năm.',
  'intro.2.a': 'Cho đến đêm nó tắt.',
  'intro.2.b': 'Không ai biết vì sao. Chỉ biết rằng từ sáng hôm sau, tro bắt đầu rơi — và chưa từng ngừng lại.',
  'intro.3.a': 'Ba mươi năm tro rơi. Người chết không còn nằm yên.',
  'intro.3.b': 'Và sâu dưới Hầm Mộ Cổ, có thứ gì đó đang thở — Kẻ Than Hồng đang thức giấc.',
  'intro.4.a': 'Ngươi mang trong mình tia lửa cuối cùng.',
  'intro.4.b': 'Hãy đến Emberfall. Trước khi tro phủ kín tất cả.',

  // ---- HUD
  'hud.level': 'Cấp {n}',
  'hud.hp': 'Máu',
  'hud.fury': 'Nộ',
  'hud.potions': 'Bình máu',
  'hud.levelup': 'Lên cấp {n}!',
  'hud.denied.fury': 'Không đủ Nộ',
  'hud.denied.cooldown': 'Kỹ năng đang hồi',
  'hud.denied.locked': 'Chưa mở khoá',
  'hud.potion.empty': 'Hết bình máu',
  'hud.potion.full': 'Máu đang đầy',
  'hud.potion.pickup': '+1 Bình máu',
  'hud.died': 'NGƯƠI ĐÃ NGÃ XUỐNG',
  'hud.respawn': 'Tia lửa đưa ngươi trở lại...',
  'hud.gate.open': 'Cổng Hầm Mộ đã mở',
  'hud.gate.locked': 'Cổng bị phong ấn. Hãy dọn sạch nghĩa địa trước.',
  'hud.checkpoint': 'Đã lưu điểm hồi sinh',
  'hud.nova.unlock': 'Mở khoá kỹ năng: Bùng Lửa (phím 3)',
  'hud.loading': 'Đang tải...',

  // ---- skills
  'skill.basic': 'Đánh Thường',
  'skill.basic.desc': 'Chém một mục tiêu. Nhận Nộ khi trúng.',
  'skill.cleave': 'Chém Xoáy',
  'skill.cleave.desc': 'Chém vòng cung phía trước, trúng nhiều kẻ địch. 20 Nộ.',
  'skill.charge': 'Lao Tới',
  'skill.charge.desc': 'Lao tới vị trí con trỏ, đẩy lùi kẻ địch. 15 Nộ, hồi 6 giây.',
  'skill.nova': 'Bùng Lửa',
  'skill.nova.desc': 'Vòng lửa nổ quanh người, thiêu đốt kẻ địch. 40 Nộ, hồi 12 giây.',

  // ---- enemies / npc
  'enemy.husk': 'Xác Sống',
  'enemy.hound': 'Chó Tro',
  'enemy.archer': 'Xương Cung',
  'enemy.warden': 'Kẻ Gác Mộ',
  'npc.elder': 'Trưởng Lão Maren',
  'player.name': 'Lữ Khách',

  // ---- tutorial hints
  'tut.move': 'Click chuột trái lên mặt đất để di chuyển. Hãy tới chỗ đống lửa giữa làng.',
  'tut.talk': 'Click vào Trưởng Lão Maren để nói chuyện.',
  'tut.attack': 'Click vào kẻ địch để tấn công. Giữ chuột để đánh liên tục.',
  'tut.cleave': 'Đánh thường để tích Nộ. Khi đủ 20 Nộ, nhấn 1 để Chém Xoáy cả bầy.',
  'tut.charge': 'Nhấn 2 để Lao Tới vị trí con trỏ chuột — bắt kịp con Chó Tro.',
  'tut.potion': 'Ngươi bị thương. Nhấn Q để uống bình máu.',
  'tut.clear': 'Dọn sạch nghĩa địa phía đông bắc để phá phong ấn cổng Hầm Mộ.',

  // ---- dialogue: elder
  'dlg.elder.1': 'Một tia lửa... Ta đã ngửi thấy nó từ khi ngươi bước qua cổng làng.',
  'dlg.elder.2': 'Ta là Maren. Ba mươi năm nay ta giữ đống lửa này cháy, chờ một người như ngươi.',
  'dlg.elder.3': 'Ngọn Lửa Vĩnh Hằng không tự tắt. Có kẻ đã nuốt nó — dưới Hầm Mộ Cổ, phía sau nghĩa địa.',
  'dlg.elder.4': 'Lũ xác sống đang tràn khỏi mộ. Dọn sạch chúng, phong ấn trên cổng hầm sẽ vỡ.',
  'dlg.elder.5': 'Đi đi, Lữ Khách. Và đừng để tia lửa của ngươi tắt.',
  'dlg.player.1': 'Ta sẽ tìm ra kẻ đó.',

  // ---- crypt
  'dlg.altar.1': 'Trên bệ thờ, một mẩu than hồng vẫn còn ấm. Tia lửa trong ngươi bùng lên đáp lại.',
  'dlg.boss.1': 'KẺ MANG LỬA... CUỐI CÙNG NGƯƠI CŨNG ĐẾN.',
  'dlg.boss.2': 'CHỦ NHÂN TA ĐÃ NUỐT NGỌN LỬA. GIỜ ĐẾN LƯỢT NGƯƠI.',
  'map.emberfall': 'Làng Emberfall',
  'map.crypt': 'Hầm Mộ Cổ',

  // ---- ending
  'end.title': 'Hết bản demo',
  'end.line': 'Kẻ Gác Mộ đã ngã. Nhưng sâu hơn nữa, Kẻ Than Hồng vẫn đang thở...',
  'end.time': 'Thời gian chơi: {v}',
  'end.kills': 'Kẻ địch đã hạ: {v}',
  'end.level': 'Cấp đạt được: {v}',
  'end.deaths': 'Số lần ngã xuống: {v}',
  'end.again': 'Chơi lại từ đầu',
  'end.thanks': 'Cảm ơn đã chơi thử Ashfall.',
};

export function t(key: string, vars?: Record<string, string | number>): string {
  const s = STRINGS[key];
  if (s === undefined) return key;
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
