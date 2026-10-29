// =============================================
//  ことば（日本語・English・繁體中文・한국어）
//  ===========================================

(function () {
  var LANGS = ['ja', 'en', 'zh', 'ko'];
  var KEY = 'hanetank-lang';
  var D = {
 "lang_label": [
  "ことば",
  "Language",
  "語言",
  "언어"
 ],
 "home": [
  "なすびのお庭へ",
  "Nasubi's Garden (more games)",
  "前往茄子的庭院",
  "가지의 정원으로"
 ],
 "howto": [
  "あそびかた",
  "How to play",
  "玩法",
  "플레이 방법"
 ],
 "close": [
  "とじる",
  "Close",
  "關閉",
  "닫기"
 ],
 "back": [
  "もどる",
  "Back",
  "返回",
  "돌아가기"
 ],
 "to_title": [
  "タイトルへ",
  "Back to title",
  "回到標題",
  "타이틀로"
 ],
 "again": [
  "もう一回",
  "Play again",
  "再來一局",
  "한 판 더"
 ],
 "easy": [
  "よわい",
  "Easy",
  "簡單",
  "약함"
 ],
 "normal": [
  "ふつう",
  "Normal",
  "普通",
  "보통"
 ],
 "hard": [
  "つよい",
  "Hard",
  "困難",
  "강함"
 ],
 "vs_cpu": [
  "CPUとたいせん",
  "VS CPU",
  "對戰CPU",
  "CPU와 대전"
 ],
 "online": [
  "あいことばで対戦",
  "Play with a passcode",
  "用暗號對戰",
  "암호로 대전"
 ],
 "passcode": [
  "あいことば",
  "Passcode",
  "暗號",
  "암호"
 ],
 "name": [
  "なまえ",
  "Name",
  "名字",
  "이름"
 ],
 "noname": [
  "ななし",
  "Anonymous",
  "無名氏",
  "익명"
 ],
 "online_hint": [
  "同じあいことばを入れた人と対戦。3人目からは観戦になります。",
  "Play against whoever enters the same passcode. From the 3rd person on, you watch.",
  "和輸入相同暗號的人對戰。第3個人開始為觀戰。",
  "같은 암호를 입력한 사람과 대전. 3번째 사람부터는 관전이 됩니다."
 ],
 "join": [
  "はいる",
  "Join",
  "進入",
  "입장"
 ],
 "wait_pre": [
  "あいことば「",
  "Passcode: ",
  "暗號「",
  "암호 「"
 ],
 "wait_post": [
  "」",
  "",
  "」",
  "」"
 ],
 "waiting": [
  "あいてを待っています…",
  "Waiting for an opponent…",
  "等待對手中…",
  "상대를 기다리는 중…"
 ],
 "copy_link": [
  "さそうリンクをコピー",
  "Copy invite link",
  "複製邀請連結",
  "초대 링크 복사"
 ],
 "copied": [
  "コピーしました！",
  "Copied!",
  "已複製！",
  "복사했어요!"
 ],
 "send_link": [
  "このリンクを送ってください",
  "Send this link",
  "請傳送這個連結",
  "이 링크를 보내 주세요"
 ],
 "err_code": [
  "あいことばを入れてください（. # $ / [ ] は使えません）",
  "Enter a passcode (. # $ / [ ] are not allowed)",
  "請輸入暗號（不能使用 . # $ / [ ]）",
  "암호를 입력해 주세요 (. # $ / [ ] 는 사용할 수 없어요)"
 ],
 "err_code_short": [
  "あいことばを入れてください",
  "Enter a passcode",
  "請輸入暗號",
  "암호를 입력해 주세요"
 ],
 "connecting": [
  "つないでいます…",
  "Connecting…",
  "連線中…",
  "연결 중…"
 ],
 "err_net": [
  "通信できませんでした。電波のよいところでもう一度ためしてください",
  "Couldn't connect. Please try again where the signal is better.",
  "無法連線。請在訊號好的地方再試一次。",
  "연결하지 못했어요. 신호가 좋은 곳에서 다시 시도해 주세요."
 ],
 "err_notready": [
  "オンライン対戦はまだ準備中です",
  "Online play isn't ready yet",
  "線上對戰還在準備中",
  "온라인 대전은 아직 준비 중이에요"
 ],
 "err_conn": [
  "つながりませんでした",
  "Couldn't connect",
  "無法連線",
  "연결되지 않았어요"
 ],
 "left_win": [
  "相手が抜けたので、あなたの勝ち！",
  "Your opponent left, so you win!",
  "對手離開了，你贏了！",
  "상대가 나가서 당신의 승리!"
 ],
 "left": [
  "のこり",
  "Left",
  "剩餘",
  "남음"
 ],
 "watch_in": [
  "観戦で入りました。試合が始まるのを待っています…",
  "You joined as a spectator. Waiting for the game to start…",
  "已用觀戰身分進入。等待比賽開始…",
  "관전으로 입장했어요. 경기 시작을 기다리는 중…"
 ],
 "wait_next": [
  "次の試合が始まるのを待っています…",
  "Waiting for the next game…",
  "等待下一局開始…",
  "다음 경기를 기다리는 중…"
 ],
 "wait_rematch": [
  "あいての「もう一回」を待っています…",
  "Waiting for your opponent to choose \"Play again\"…",
  "等待對手按「再來一局」…",
  "상대의 '한 판 더'를 기다리는 중…"
 ],
 "you": [
  "あなた",
  "You",
  "你",
  "나"
 ],
 "cpu": [
  "CPU",
  "CPU",
  "CPU",
  "CPU"
 ],
 "your_turn": [
  "あなたの番",
  "Your turn",
  "輪到你",
  "내 차례"
 ],
 "cpu_wait_label": [
  "CPU（ふつう）と遊びながら待つ",
  "Play the CPU (Normal) while waiting",
  "一邊和CPU（普通）玩一邊等",
  "기다리는 동안 CPU(보통)와 플레이"
 ],
 "qm_btn": [
  "だれかと対戦",
  "Play someone online",
  "隨機對戰",
  "아무나와 대전"
 ],
 "qm_stat": [
  "対戦待ち <b>{w}</b>人・対戦中 <b>{p}</b>組",
  "<b>{w}</b> waiting · <b>{p}</b> playing",
  "等待中 <b>{w}</b>人・對戰中 <b>{p}</b>組",
  "대기 <b>{w}</b>명 · 대전 중 <b>{p}</b>쌍"
 ],
 "qm_prime_hot": [
  "🔥 いま対戦タイム！（22時まで）",
  "🔥 Battle time now! (until 22:00 JST)",
  "🔥 現在是對戰時間！（到日本時間22點）",
  "🔥 지금은 대전 타임! (일본 시간 22시까지)"
 ],
 "qm_prime": [
  "🌙 毎晩21時〜22時は対戦タイム",
  "🌙 Battle time every night 21:00–22:00 JST",
  "🌙 每晚日本時間21〜22點是對戰時間",
  "🌙 매일 밤 일본 시간 21~22시는 대전 타임"
 ],
 "qm_sub": [
  "いま待っている人と、自動でつながります。",
  "You'll be matched automatically with someone who's waiting.",
  "自動和正在等待的人配對。",
  "기다리고 있는 사람과 자동으로 연결돼요."
 ],
 "qm_go": [
  "さがす",
  "Find a match",
  "尋找",
  "찾기"
 ],
 "qm_badname": [
  "その名前は使えません。ほかの名前にしてね",
  "That name can't be used. Please choose another.",
  "這個名字不能使用，請換一個。",
  "그 이름은 사용할 수 없어요. 다른 이름으로 해 주세요."
 ],
 "qm_searching": [
  "相手をさがしています",
  "Looking for an opponent",
  "正在尋找對手",
  "상대를 찾는 중"
 ],
 "qm_wait_pre": [
  "いま対戦待ち ",
  "Waiting now: ",
  "目前等待中 ",
  "현재 대기 "
 ],
 "qm_wait_post": [
  "人",
  "",
  "人",
  "명"
 ],
 "qm_cpu": [
  "CPUと遊びながら待つ",
  "Play the CPU while waiting",
  "一邊和CPU玩一邊等",
  "기다리는 동안 CPU와 플레이"
 ],
 "qm_cancel": [
  "やめる",
  "Cancel",
  "取消",
  "그만두기"
 ],
 "qm_retry": [
  "もう一度さがす",
  "Search again",
  "再找一次",
  "다시 찾기"
 ],
 "qm_searching_t": [
  "相手をさがしています… {t}",
  "Looking for an opponent… {t}",
  "正在尋找對手… {t}",
  "상대를 찾는 중… {t}"
 ],
 "qm_calling": [
  "CPUと遊んでいる人に声をかけています…",
  "Inviting someone who is playing the CPU…",
  "正在邀請正在和CPU玩的人…",
  "CPU와 플레이 중인 사람에게 신청하는 중…"
 ],
 "qm_declined": [
  "相手が見送りました。ほかの人をさがします",
  "They passed. Looking for someone else.",
  "對方跳過了，改找其他人。",
  "상대가 넘겼어요. 다른 사람을 찾을게요."
 ],
 "qm_found": [
  "相手が見つかりました！",
  "Opponent found!",
  "找到對手了！",
  "상대를 찾았어요!"
 ],
 "qm_avail": [
  "対戦できる相手がいます！",
  "Someone is ready to play!",
  "有可以對戰的對手！",
  "대전할 수 있는 상대가 있어요!"
 ],
 "qm_play": [
  "対戦する",
  "Play",
  "對戰",
  "대전하기"
 ],
 "qm_pass": [
  "見送る",
  "Pass",
  "跳過",
  "넘기기"
 ],
 "qm_taken": [
  "さっきの相手は、ほかの人と対戦を始めました。もう少し待ってね",
  "That player started a match with someone else. Please wait a little longer.",
  "剛才的對手已經和別人開始對戰了。請再等一下。",
  "방금 상대는 다른 사람과 대전을 시작했어요. 조금만 더 기다려 주세요."
 ],
 "qm_fail": [
  "相手とつながりませんでした（{c}）",
  "Couldn't connect to your opponent ({c})",
  "無法和對手連線（{c}）",
  "상대와 연결되지 않았어요 ({c})"
 ],
 "qm_nojoin": [
  "入れませんでした",
  "Couldn't join",
  "無法進入",
  "들어가지 못했어요"
 ],
 "qm_next": [
  "次の相手をさがす",
  "Find next opponent",
  "尋找下一位對手",
  "다음 상대 찾기"
 ],
 "doc_title": [
  "ハネタンク",
  "Bounce Tank",
  "彈跳坦克",
  "튕김 탱크"
 ],
 "doc_desc": [
  "はね返る弾で撃ち合う、おもちゃの戦車バトル。スキルを振って、ブロックを置いて、2本先取！",
  "A toy tank battle with bouncing shots. Spend skill points, place blocks, first to 2 wins!",
  "用會反彈的子彈互射的玩具坦克對戰。分配技能、放置方塊，先拿2勝！",
  "튕기는 탄으로 쏘는 장난감 탱크 배틀. 스킬을 찍고 블록을 놓고, 2승 선취!"
 ],
 "logo1": [
  "ハネ",
  "BOUNCE",
  "彈跳",
  "튕김"
 ],
 "logo2": [
  "タンク",
  "TANK",
  "坦克",
  "탱크"
 ],
 "tagline": [
  "はね返る弾で撃ち合う、おもちゃの戦車バトル",
  "A toy tank battle with bouncing shots",
  "用會反彈的子彈互射的玩具坦克對戰",
  "튕기는 탄으로 쏘는 장난감 탱크 배틀"
 ],
 "local": [
  "ふたりで（同じPC）",
  "2 players (same PC)",
  "雙人（同一台電腦）",
  "둘이서 (같은 PC)"
 ],
 "practice": [
  "れんしゅう",
  "Practice",
  "練習",
  "연습"
 ],
 "tank": [
  "せんしゃ",
  "Tank",
  "坦克",
  "탱크"
 ],
 "mine": [
  "地雷",
  "Mine",
  "地雷",
  "지뢰"
 ],
 "menu": [
  "メニュー",
  "Menu",
  "選單",
  "메뉴"
 ],
 "stamp": [
  "スタンプ",
  "Stamps",
  "貼圖",
  "스탬프"
 ],
 "ex_code": [
  "4けたの数字など",
  "e.g. a 4-digit number",
  "例如4位數字",
  "예: 4자리 숫자"
 ],
 "dice": [
  "おまかせ",
  "Random",
  "隨機",
  "자동"
 ],
 "online_note": [
  "同じ「あいことば」を入れた人と対戦できます。3人目からは観戦になります。",
  "Play against whoever enters the same passcode. From the 3rd person on, you watch.",
  "可以和輸入相同「暗號」的人對戰。第3個人開始為觀戰。",
  "같은 \"암호\"를 입력한 사람과 대전할 수 있어요. 3번째 사람부터는 관전이 됩니다."
 ],
 "do_play": [
  "対戦する",
  "Play",
  "對戰",
  "대전하기"
 ],
 "watch_only": [
  "観戦だけ",
  "Watch only",
  "只觀戰",
  "관전만"
 ],
 "wait_title": [
  "相手を待っています",
  "Waiting for an opponent",
  "等待對手中",
  "상대를 기다리는 중"
 ],
 "code_label": [
  "あいことば ",
  "Passcode ",
  "暗號 ",
  "암호 "
 ],
 "invite_note": [
  "招待リンクを送るか、相手に同じあいことばを入れてもらってね",
  "Send the invite link, or have your opponent enter the same passcode",
  "傳送邀請連結，或請對手輸入相同的暗號",
  "초대 링크를 보내거나, 상대에게 같은 암호를 입력해 달라고 하세요"
 ],
 "invite": [
  "招待リンクを送る",
  "Send invite link",
  "傳送邀請連結",
  "초대 링크 보내기"
 ],
 "cancel": [
  "やめる",
  "Cancel",
  "取消",
  "그만두기"
 ],
 "skill_title": [
  "スキルをふろう",
  "Spend skill points",
  "分配技能",
  "스킬을 찍자"
 ],
 "auto": [
  "おまかせ",
  "Auto",
  "自動",
  "자동"
 ],
 "reset": [
  "もとにもどす",
  "Reset",
  "重設",
  "되돌리기"
 ],
 "ready": [
  "準備OK",
  "Ready",
  "準備好了",
  "준비 완료"
 ],
 "ready_undo": [
  "準備OK！（取り消す）",
  "Ready! (tap to undo)",
  "準備好了！（取消）",
  "준비 완료! (취소)"
 ],
 "ready_done": [
  "準備OK！",
  "Ready!",
  "準備好了！",
  "준비 완료!"
 ],
 "place_title": [
  "ブロックを置こう",
  "Place your blocks",
  "放置方塊",
  "블록을 놓자"
 ],
 "place_hint": [
  "自分の陣地をタップ。もう一度タップで取り消し",
  "Tap your side to place. Tap again to remove.",
  "點自己的陣地放置，再點一次取消",
  "내 진영을 탭. 한 번 더 탭하면 취소"
 ],
 "hard_b": [
  "かたい ",
  "Hard ",
  "堅固 ",
  "단단함 "
 ],
 "soft_b": [
  "こわれる ",
  "Breakable ",
  "可破壞 ",
  "부서짐 "
 ],
 "begin": [
  "はじめる",
  "Start",
  "開始",
  "시작"
 ],
 "replay": [
  "リプレイ",
  "Replay",
  "重播",
  "리플레이"
 ],
 "next": [
  "つぎへ",
  "Next",
  "下一場",
  "다음"
 ],
 "resume": [
  "つづける",
  "Resume",
  "繼續",
  "계속하기"
 ],
 "sound_on": [
  "音：オン",
  "Sound: On",
  "音效：開",
  "소리: 켜짐"
 ],
 "sound_off": [
  "音：オフ",
  "Sound: Off",
  "音效：關",
  "소리: 꺼짐"
 ],
 "vib_on": [
  "振動：オン",
  "Vibration: On",
  "震動：開",
  "진동: 켜짐"
 ],
 "vib_off": [
  "振動：オフ",
  "Vibration: Off",
  "震動：關",
  "진동: 꺼짐"
 ],
 "quality": [
  "画質：{q}",
  "Quality: {q}",
  "畫質：{q}",
  "화질: {q}"
 ],
 "q_auto": [
  "じどう",
  "Auto",
  "自動",
  "자동"
 ],
 "q_high": [
  "高",
  "High",
  "高",
  "높음"
 ],
 "q_mid": [
  "中",
  "Medium",
  "中",
  "중간"
 ],
 "q_low": [
  "低",
  "Low",
  "低",
  "낮음"
 ],
 "leave_match": [
  "対戦をぬける",
  "Leave match",
  "離開對戰",
  "대전 나가기"
 ],
 "look_note": [
  "見た目だけ変わります（強さは同じ）",
  "Only the look changes (same strength)",
  "只改變外觀（強度相同）",
  "겉모습만 바뀌어요 (강함은 같음)"
 ],
 "you_1p": [
  "あなた（1P）",
  "You (1P)",
  "你（1P）",
  "나 (1P)"
 ],
 "color": [
  "いろ",
  "Color",
  "顏色",
  "색"
 ],
 "pattern": [
  "もよう",
  "Pattern",
  "花紋",
  "무늬"
 ],
 "decide": [
  "きめた",
  "Done",
  "決定",
  "결정"
 ],
 "fold": [
  "たたむ",
  "Hide",
  "收起",
  "접기"
 ],
 "unfold": [
  "ひらく",
  "Show",
  "展開",
  "펼치기"
 ],
 "finish": [
  "おわる",
  "Quit",
  "結束",
  "끝내기"
 ],
 "rotate": [
  "スマホを<b>横向き</b>にしてね",
  "Turn your phone <b>sideways</b>",
  "請把手機<b>橫放</b>",
  "휴대폰을 <b>가로</b>로 돌려 주세요"
 ],
 "hw_rules": [
  "ルール",
  "Rules",
  "規則",
  "규칙"
 ],
 "hw_flow": [
  "1戦ごとの流れ",
  "Each battle",
  "每一戰的流程",
  "한 판의 흐름"
 ],
 "hw_ctrl": [
  "そうさ",
  "Controls",
  "操作",
  "조작"
 ],
 "r1": [
  "弾が1発当たったら負け。<b>自分の弾・地雷でもやられます</b>。",
  "One hit and you lose. <b>Your own shots and mines can get you too</b>.",
  "中1發子彈就輸。<b>自己的子彈和地雷也會打到自己</b>。",
  "탄에 한 발 맞으면 패배. <b>내 탄·지뢰에도 당해요</b>."
 ],
 "r2": [
  "弾は壁ではね返ります。弾どうしがぶつかると両方消えます。",
  "Shots bounce off walls. When two shots collide, both disappear.",
  "子彈會在牆上反彈。子彈互撞時兩顆都會消失。",
  "탄은 벽에서 튕겨요. 탄끼리 부딪히면 둘 다 사라져요."
 ],
 "r3": [
  "同時に撃てる弾は3発まで（戦車の足元の点が残りの数）、地雷は2個まで。",
  "Up to 3 shots at once (the dots under your tank show how many are left), and up to 2 mines.",
  "同時最多3發子彈（坦克下方的點是剩餘數量），地雷最多2個。",
  "동시에 쏠 수 있는 탄은 3발까지 (탱크 발밑의 점이 남은 수), 지뢰는 2개까지."
 ],
 "r4": [
  "地雷は少したつか、弾が当たると爆発。<b>ピンクのブロック</b>をこわせます。",
  "Mines explode after a moment or when shot. They can break <b>pink blocks</b>.",
  "地雷過一會兒或被子彈打中就會爆炸，可以炸掉<b>粉紅色方塊</b>。",
  "지뢰는 조금 지나거나 탄에 맞으면 폭발. <b>분홍 블록</b>을 부술 수 있어요."
 ],
 "r5": [
  "穴は弾は通るけど、戦車は入れません。",
  "Shots pass over holes, but tanks can't enter them.",
  "子彈能飛過洞，但坦克進不去。",
  "구멍은 탄은 지나가지만 탱크는 못 들어가요."
 ],
 "r6": [
  "2本先取。90秒たつと外側から壁がせまってきます。",
  "First to 2 wins. After 90 seconds, walls close in from the outside.",
  "先拿2勝。90秒後牆壁會從外側逼近。",
  "2승 선취. 90초가 지나면 바깥부터 벽이 좁혀와요."
 ],
 "r7": [
  "同時にやられたら引き分け。すぐにもう一回。",
  "If both tanks go down at once, it's a draw — play again right away.",
  "同時被打倒就是平手，馬上再來一次。",
  "동시에 당하면 무승부. 바로 한 번 더."
 ],
 "f1": [
  "<b>スキル（30秒）</b>：ポイントを4つの性能にふります。1戦目6pt → 9pt → 12pt。毎回ふり直し。迷ったら「おまかせ」。",
  "<b>Skills (30s)</b>: spend points on 4 stats. 6pt in battle 1 → 9pt → 12pt. Re-spend every battle. Not sure? Tap \"Auto\".",
  "<b>技能（30秒）</b>：把點數分配到4種性能。第1戰6pt → 9pt → 12pt。每次重新分配。拿不定主意就按「自動」。",
  "<b>스킬 (30초)</b>: 포인트를 4가지 성능에 찍어요. 1판 6pt → 9pt → 12pt. 매번 다시 찍기. 고민되면 \"자동\"."
 ],
 "f2": [
  "たまの速さ・たまの大きさは、上げても下げてもポイントを使います。",
  "Shot speed and shot size cost points whether you raise or lower them.",
  "子彈速度、子彈大小不論調高或調低都會用掉點數。",
  "탄 속도·탄 크기는 올려도 내려도 포인트를 써요."
 ],
 "f3": [
  "はねかえりは上げるだけ（1〜2で1回、3〜4で2回、5〜6で3回、7で4回）。",
  "Bounces can only go up (Lv1–2: 1, Lv3–4: 2, Lv5–6: 3, Lv7: 4).",
  "反彈只能調高（1〜2為1次、3〜4為2次、5〜6為3次、7為4次）。",
  "튕김은 올리기만 (1~2는 1번, 3~4는 2번, 5~6은 3번, 7은 4번)."
 ],
 "f4": [
  "戦車を大きくするとポイントがもらえます（小さくするとポイントを使う）。大きい戦車はせまい道を通れません。",
  "Making your tank bigger gives you points (smaller costs points). Big tanks can't fit through narrow paths.",
  "把坦克變大可以拿到點數（變小會用掉點數）。大坦克過不了窄路。",
  "탱크를 크게 하면 포인트를 받아요 (작게 하면 포인트를 씀). 큰 탱크는 좁은 길을 못 지나가요."
 ],
 "f5": [
  "<b>ブロック（20秒）</b>：自分の陣地に、かたいブロック2個とこわれるブロック2個を置けます。置いたブロックは戦いが始まるまで相手には見えません。",
  "<b>Blocks (20s)</b>: place 2 hard blocks and 2 breakable blocks on your side. Your opponent can't see them until the battle starts.",
  "<b>方塊（20秒）</b>：可以在自己的陣地放2個堅固方塊和2個可破壞方塊。開戰前對手看不到。",
  "<b>블록 (20초)</b>: 내 진영에 단단한 블록 2개와 부서지는 블록 2개를 놓을 수 있어요. 싸움이 시작될 때까지 상대에게 안 보여요."
 ],
 "f6": [
  "相手の性能は、1戦終わるまでわかりません。",
  "You won't know your opponent's stats until the battle ends.",
  "對手的性能要等一戰結束才知道。",
  "상대의 성능은 한 판이 끝날 때까지 몰라요."
 ],
 "c1": [
  "<b>スマホ（横向き）</b>：左側で移動、右側をドラッグしてねらい、はなすと発射。ちょんとタップでも発射。右下のボタンで地雷。",
  "<b>Phone (landscape)</b>: move with the left side, drag on the right side to aim and release to fire. A quick tap also fires. Bottom-right button for mines.",
  "<b>手機（橫向）</b>：左側移動，在右側拖曳瞄準，放開發射。輕點也能發射。右下按鈕放地雷。",
  "<b>스마트폰 (가로)</b>: 왼쪽으로 이동, 오른쪽을 드래그해 조준하고 떼면 발사. 살짝 탭해도 발사. 오른쪽 아래 버튼으로 지뢰."
 ],
 "c2": [
  "<b>PC</b>：WASDで移動、マウスでねらい、クリックで発射、右クリックかスペースで地雷。",
  "<b>PC</b>: WASD to move, mouse to aim, click to fire, right-click or Space for mines.",
  "<b>電腦</b>：WASD移動，滑鼠瞄準，點擊發射，右鍵或空白鍵放地雷。",
  "<b>PC</b>: WASD로 이동, 마우스로 조준, 클릭으로 발사, 우클릭이나 스페이스로 지뢰."
 ],
 "c3": [
  "<b>同じPCで2人</b>：1P WASD移動・Q/Eで砲台・Fで発射・Gで地雷。2P 矢印で移動・，／．で砲台・／で発射・右Shiftで地雷。",
  "<b>2 players on one PC</b>: 1P WASD move · Q/E turret · F fire · G mine. 2P arrows move · , / . turret · / fire · Right Shift mine.",
  "<b>同一台電腦雙人</b>：1P WASD移動・Q/E砲塔・F發射・G地雷。2P 方向鍵移動・，／．砲塔・／發射・右Shift地雷。",
  "<b>같은 PC로 2명</b>: 1P WASD 이동·Q/E 포탑·F 발사·G 지뢰. 2P 방향키 이동·, / . 포탑·/ 발사·오른쪽 Shift 지뢰."
 ],
 "c4": [
  "<b>オンライン</b>：部屋を作ったら「招待リンクを送る」でLINEなどに送れます。右上の☺でスタンプ。",
  "<b>Online</b>: after making a room, use \"Send invite link\" to share it. ☺ at the top right sends stamps.",
  "<b>線上</b>：建立房間後可用「傳送邀請連結」傳到LINE等。右上的☺可以送貼圖。",
  "<b>온라인</b>: 방을 만들면 \"초대 링크 보내기\"로 LINE 등에 보낼 수 있어요. 오른쪽 위 ☺로 스탬프."
 ],
 "c5": [
  "<b>コントローラー</b>：左スティックで移動、右スティックでねらい、RかAで発射、LかBで地雷。",
  "<b>Controller</b>: left stick to move, right stick to aim, R or A to fire, L or B for mines.",
  "<b>手把</b>：左搖桿移動，右搖桿瞄準，R或A發射，L或B放地雷。",
  "<b>컨트롤러</b>: 왼쪽 스틱 이동, 오른쪽 스틱 조준, R이나 A로 발사, L이나 B로 지뢰."
 ],
 "no3d": [
  "この端末では3D表示ができませんでした。別のブラウザ（Chrome / Safari）でためしてください。",
  "This device couldn't show 3D. Please try another browser (Chrome / Safari).",
  "這台裝置無法顯示3D。請改用其他瀏覽器（Chrome / Safari）試試。",
  "이 기기에서는 3D를 표시할 수 없어요. 다른 브라우저(Chrome / Safari)로 시도해 주세요."
 ],
 "hi_speed": [
  "速さ",
  "Spd",
  "速度",
  "속도"
 ],
 "hi_bounce": [
  "はね",
  "Bnc",
  "反彈",
  "튕김"
 ],
 "hi_size": [
  "大きさ",
  "Size",
  "大小",
  "크기"
 ],
 "hi_bsize": [
  "弾",
  "Shot",
  "子彈",
  "탄"
 ],
 "times": [
  "{n}回",
  "×{n}",
  "{n}次",
  "{n}번"
 ],
 "replay_tap": [
  "リプレイ（タップでとばす）",
  "Replay (tap to skip)",
  "重播（點一下跳過）",
  "리플레이 (탭해서 건너뛰기)"
 ],
 "replay_click": [
  "リプレイ（クリックでとばす）",
  "Replay (click to skip)",
  "重播（點擊跳過）",
  "리플레이 (클릭해서 건너뛰기)"
 ],
 "sudden_soon": [
  "サドンデスまで あと少し",
  "Sudden death soon",
  "即將驟死戰",
  "곧 서든데스"
 ],
 "sudden": [
  "サドンデス！",
  "SUDDEN DEATH!",
  "驟死戰！",
  "서든데스!"
 ],
 "sudden_h": [
  "サドンデス",
  "SUDDEN DEATH",
  "驟死戰",
  "서든데스"
 ],
 "walls": [
  "壁がせまってくる！",
  "The walls are closing in!",
  "牆壁逼近了！",
  "벽이 좁혀온다!"
 ],
 "sk_speed": [
  "たまの速さ",
  "Shot speed",
  "子彈速度",
  "탄 속도"
 ],
 "sk_bounce": [
  "はねかえり",
  "Bounces",
  "反彈",
  "튕김"
 ],
 "sk_size": [
  "戦車の大きさ",
  "Tank size",
  "坦克大小",
  "탱크 크기"
 ],
 "sk_bsize": [
  "たまの大きさ",
  "Shot size",
  "子彈大小",
  "탄 크기"
 ],
 "hint_cost2": [
  "上げても下げてもポイントを使う",
  "Raising or lowering both cost points",
  "調高調低都會用掉點數",
  "올려도 내려도 포인트를 씀"
 ],
 "hint_bounce": [
  "上げるだけ。1〜2で1回、7で4回",
  "Up only. Lv1–2: 1 bounce, Lv7: 4",
  "只能調高。1〜2為1次，7為4次",
  "올리기만. 1~2는 1번, 7은 4번"
 ],
 "hint_size": [
  "大きくするとポイントがもらえる",
  "Bigger gives you points",
  "變大可以拿到點數",
  "크게 하면 포인트를 받음"
 ],
 "sp1": [
  "とてもおそい",
  "Very slow",
  "非常慢",
  "아주 느림"
 ],
 "sp2": [
  "おそい",
  "Slow",
  "慢",
  "느림"
 ],
 "sp3": [
  "ややおそい",
  "A bit slow",
  "稍慢",
  "조금 느림"
 ],
 "sp4": [
  "ふつう",
  "Normal",
  "普通",
  "보통"
 ],
 "sp5": [
  "ややはやい",
  "A bit fast",
  "稍快",
  "조금 빠름"
 ],
 "sp6": [
  "はやい",
  "Fast",
  "快",
  "빠름"
 ],
 "sp7": [
  "とてもはやい",
  "Very fast",
  "非常快",
  "아주 빠름"
 ],
 "sz1": [
  "とても小さい",
  "Very small",
  "非常小",
  "아주 작음"
 ],
 "sz2": [
  "小さい",
  "Small",
  "小",
  "작음"
 ],
 "sz3": [
  "やや小さい",
  "A bit small",
  "稍小",
  "조금 작음"
 ],
 "sz4": [
  "ふつう",
  "Normal",
  "普通",
  "보통"
 ],
 "sz5": [
  "やや大きい",
  "A bit big",
  "稍大",
  "조금 큼"
 ],
 "sz6": [
  "大きい",
  "Big",
  "大",
  "큼"
 ],
 "sz7": [
  "とても大きい",
  "Very big",
  "非常大",
  "아주 큼"
 ],
 "no_more": [
  "もう置けません（さわると取り消し）",
  "Can't place more (tap a block to remove it)",
  "不能再放了（點一下可取消）",
  "더 놓을 수 없어요 (만지면 취소)"
 ],
 "own_side": [
  "自分の陣地（色のついた側）にだけ置けます",
  "You can only place on your side (the colored half)",
  "只能放在自己的陣地（有顏色的那一側）",
  "내 진영 (색이 칠해진 쪽)에만 놓을 수 있어요"
 ],
 "cant_place": [
  "そこには置けません",
  "You can't place there",
  "那裡不能放",
  "거기에는 놓을 수 없어요"
 ],
 "near_spawn": [
  "スタート地点のそばには置けません",
  "You can't place next to a start point",
  "不能放在出發點旁邊",
  "출발 지점 옆에는 놓을 수 없어요"
 ],
 "blocks_path": [
  "道がふさがるので置けません",
  "You can't place there — it would block the path",
  "會擋住道路所以不能放",
  "길이 막혀서 놓을 수 없어요"
 ],
 "cpu_lv": [
  "CPU（{lv}）",
  "CPU ({lv})",
  "CPU（{lv}）",
  "CPU ({lv})"
 ],
 "p_turn": [
  "{p}の番です",
  "{p}'s turn",
  "輪到{p}",
  "{p} 차례예요"
 ],
 "dont_look_skill": [
  "{p}は画面を見ないでね（スキルをふります）",
  "{p}, don't look at the screen (skills being chosen)",
  "{p}請不要看畫面（正在分配技能）",
  "{p}은 화면을 보지 마세요 (스킬을 찍어요)"
 ],
 "dont_look_block": [
  "{p}は画面を見ないでね（ブロックを置きます）",
  "{p}, don't look at the screen (blocks being placed)",
  "{p}請不要看畫面（正在放置方塊）",
  "{p}은 화면을 보지 마세요 (블록을 놓아요)"
 ],
 "dont_look": [
  "{p}は画面を見ないでね",
  "{p}, don't look at the screen",
  "{p}請不要看畫面",
  "{p}은 화면을 보지 마세요"
 ],
 "stage_title": [
  "{n}戦目・ステージ：{st}（{pt}pt）",
  "Battle {n} · Stage: {st} ({pt}pt)",
  "第{n}戰・關卡：{st}（{pt}pt）",
  "{n}판째 · 스테이지: {st} ({pt}pt)"
 ],
 "battle_n": [
  "{n}戦目",
  "Battle {n}",
  "第{n}戰",
  "{n}판째"
 ],
 "p_skill": [
  "{p}のスキル",
  "{p}'s skills",
  "{p}的技能",
  "{p}의 스킬"
 ],
 "p_block": [
  "{p}のブロック",
  "{p}'s blocks",
  "{p}的方塊",
  "{p}의 블록"
 ],
 "cpu_ready": [
  "CPU：準備OK",
  "CPU: Ready",
  "CPU：準備好了",
  "CPU: 준비 완료"
 ],
 "draw_again": [
  "ひきわけ！ もう一回",
  "Draw! Once more",
  "平手！再來一次",
  "무승부! 한 번 더"
 ],
 "record": [
  "{name}との通算：{w}勝 {l}敗",
  "Vs {name}: {w}W {l}L",
  "對{name}總戰績：{w}勝 {l}敗",
  "{name}과의 통산: {w}승 {l}패"
 ],
 "you_win": [
  "あなたの勝ち！",
  "You win!",
  "你贏了！",
  "승리!"
 ],
 "cpu_win": [
  "CPUの勝ち…",
  "CPU wins…",
  "CPU贏了…",
  "CPU 승리…"
 ],
 "round_win": [
  "かち！",
  "WIN!",
  "贏了！",
  "이겼다!"
 ],
 "round_lose": [
  "まけ…",
  "Lost…",
  "輸了…",
  "졌다…"
 ],
 "x_win": [
  "{p}の勝ち！",
  "{p} wins!",
  "{p}贏了！",
  "{p} 승리!"
 ],
 "x_round": [
  "{p}のかち！",
  "{p} takes the round!",
  "{p}這局贏了！",
  "{p} 이번 판 승리!"
 ],
 "opp_cpu_tank": [
  "あいて（CPU）の戦車",
  "Opponent's tank (CPU)",
  "對手（CPU）的坦克",
  "상대 (CPU)의 탱크"
 ],
 "your_tank": [
  "あなたの戦車",
  "Your tank",
  "你的坦克",
  "내 탱크"
 ],
 "p_tank": [
  "{p}の戦車",
  "{p}'s tank",
  "{p}的坦克",
  "{p}의 탱크"
 ],
 "opp_tank": [
  "あいて（{name}）の戦車",
  "Opponent's tank ({name})",
  "對手（{name}）的坦克",
  "상대 ({name})의 탱크"
 ],
 "next_n": [
  "つぎへ（{n}戦目）",
  "Next (battle {n})",
  "下一場（第{n}戰）",
  "다음 ({n}판째)"
 ],
 "target": [
  "まと",
  "Target",
  "靶子",
  "과녁"
 ],
 "hits": [
  "あてた数 {n}",
  "Hits: {n}",
  "命中數 {n}",
  "맞힌 수 {n}"
 ],
 "p2_note": [
  "同じPCで2人で遊ぶときの2Pの戦車です。1Pと同じ色にすると、2Pは別の色になります。",
  "This is 2P's tank for 2 players on one PC. If it matches 1P's color, 2P gets a different color.",
  "這是同一台電腦雙人遊玩時2P的坦克。如果和1P同色，2P會換成別的顏色。",
  "같은 PC로 둘이 놀 때 2P의 탱크예요. 1P와 같은 색이면 2P는 다른 색이 돼요."
 ],
 "opp_wait": [
  "相手の通信を待っています…",
  "Waiting for your opponent's connection…",
  "等待對手的連線…",
  "상대의 통신을 기다리는 중…"
 ],
 "watch_wait": [
  "対戦する2人がそろうのを待っています（観戦）",
  "Waiting for both players (watching)",
  "等待兩位對戰者到齊（觀戰）",
  "대전할 두 명이 모이길 기다리는 중 (관전)"
 ],
 "you_tag": [
  "{name}（あなた）",
  "{name} (you)",
  "{name}（你）",
  "{name} (나)"
 ],
 "watching_": [
  "観戦中・",
  "Watching · ",
  "觀戰中・",
  "관전 중 · "
 ],
 "p2p": [
  "直接つながっています",
  "Direct connection",
  "直接連線",
  "직접 연결"
 ],
 "server": [
  "サーバー経由",
  "Via server",
  "經由伺服器",
  "서버 경유"
 ],
 "n_watch": [
  "・観戦 {n}人",
  " · {n} watching",
  "・觀戰 {n}人",
  " · 관전 {n}명"
 ],
 "opp_state": [
  "相手：{s}",
  "Opponent: {s}",
  "對手：{s}",
  "상대: {s}"
 ],
 "choosing": [
  "えらんでいます…",
  "choosing…",
  "選擇中…",
  "고르는 중…"
 ],
 "w_skill": [
  "スキルをえらんでいます…",
  "Choosing skills…",
  "正在選擇技能…",
  "스킬을 고르는 중…"
 ],
 "w_block": [
  "ブロックを置いています…",
  "Placing blocks…",
  "正在放置方塊…",
  "블록을 놓는 중…"
 ],
 "back_online": [
  "通信が戻りました",
  "Connection restored",
  "連線恢復了",
  "통신이 돌아왔어요"
 ],
 "x_final": [
  "{name} の勝ち！",
  "{name} wins!",
  "{name}贏了！",
  "{name} 승리!"
 ],
 "x_round2": [
  "{name} のかち",
  "{name} takes the round",
  "{name}這局贏了",
  "{name} 이번 판 승리"
 ],
 "opp_win": [
  "あいての勝ち…",
  "Opponent wins…",
  "對手贏了…",
  "상대 승리…"
 ],
 "waiting_opp": [
  "相手を待っています…",
  "Waiting for opponent…",
  "等待對手…",
  "상대를 기다리는 중…"
 ],
 "auto_next": [
  "20秒たつと自動で次へ進みます",
  "Moves on automatically after 20 seconds",
  "20秒後會自動進入下一場",
  "20초가 지나면 자동으로 다음으로 넘어가요"
 ],
 "opp_left_t": [
  "相手が抜けました",
  "Your opponent left",
  "對手離開了",
  "상대가 나갔어요"
 ],
 "left_win_rand": [
  "相手が抜けたので、あなたの勝ちです。",
  "Your opponent left, so you win.",
  "對手離開了，所以你贏了。",
  "상대가 나가서 당신의 승리예요."
 ],
 "left_win_code": [
  "相手がいなくなったので、あなたの勝ちです。このまま待つと、同じあいことばで入ってきた人と対戦できます。",
  "Your opponent left, so you win. If you keep waiting, you can play whoever joins with the same passcode.",
  "對手不見了，所以你贏了。繼續等待的話，可以和用相同暗號進來的人對戰。",
  "상대가 없어져서 당신의 승리예요. 이대로 기다리면 같은 암호로 들어온 사람과 대전할 수 있어요."
 ],
 "disc": [
  "通信が切れました",
  "Disconnected",
  "連線中斷了",
  "통신이 끊겼어요"
 ],
 "disc_note": [
  "通信が切れたため、対戦から外れました。もう一度あいことばを入れて入り直してください。",
  "You were removed from the match because the connection dropped. Enter the passcode again to rejoin.",
  "因為連線中斷，已退出對戰。請重新輸入暗號再進入。",
  "통신이 끊겨서 대전에서 빠졌어요. 암호를 다시 입력해서 들어와 주세요."
 ],
 "need_kb": [
  "ふたりで遊ぶにはキーボードかコントローラーが必要です",
  "Two players need a keyboard or controllers",
  "雙人遊玩需要鍵盤或手把",
  "둘이서 하려면 키보드나 컨트롤러가 필요해요"
 ],
 "full_watch": [
  "2人そろっているので観戦します",
  "Two players are already in, so you'll watch",
  "已經有2人了，所以改為觀戰",
  "이미 두 명이 있어서 관전해요"
 ],
 "conn_fail": [
  "つながりませんでした。通信を確認して、もう一度ためしてください。",
  "Couldn't connect. Check your connection and try again.",
  "無法連線。請確認網路後再試一次。",
  "연결되지 않았어요. 통신을 확인하고 다시 시도해 주세요."
 ],
 "share_text": [
  "ハネタンクで対戦しよう！ あいことば：{code}",
  "Let's battle in Bounce Tank! Passcode: {code}",
  "來玩彈跳坦克對戰吧！暗號：{code}",
  "튕김 탱크로 대전하자! 암호: {code}"
 ],
 "link_copied": [
  "招待リンクをコピーしました。LINEなどに貼って送ってね",
  "Invite link copied. Paste it into a message to send it.",
  "已複製邀請連結。貼到LINE等傳送吧",
  "초대 링크를 복사했어요. LINE 등에 붙여서 보내세요"
 ],
 "lowered_q": [
  "なめらかに動くよう画質を下げました",
  "Lowered the quality so it runs smoothly",
  "為了流暢運行已降低畫質",
  "부드럽게 움직이도록 화질을 낮췄어요"
 ],
 "invited": [
  "招待されました！なまえを入れて「対戦する」を押してね",
  "You were invited! Enter your name and press \"Play\"",
  "你被邀請了！輸入名字再按「對戰」",
  "초대받았어요! 이름을 입력하고 \"대전하기\"를 누르세요"
 ],
 "stage0": [
  "ひろば",
  "Plaza",
  "廣場",
  "광장"
 ],
 "stage1": [
  "めいろ",
  "Maze",
  "迷宮",
  "미로"
 ],
 "stage2": [
  "あなぼこ",
  "Potholes",
  "坑坑洞洞",
  "구멍투성이"
 ],
 "mine_n": [
  "地雷<small>×{n}</small>",
  "Mine<small>×{n}</small>",
  "地雷<small>×{n}</small>",
  "지뢰<small>×{n}</small>"
 ]
};
  function pick() {
    try { var q = new URLSearchParams(location.search).get('lang'); if (q && LANGS.indexOf(q) >= 0) { try { localStorage.setItem(KEY, q); } catch (e) {} return q; } } catch (e) {}
    try { var s = localStorage.getItem(KEY); if (s && LANGS.indexOf(s) >= 0) return s; } catch (e) {}
    var n = (navigator.language || 'ja').toLowerCase();
    if (n.indexOf('ja') === 0) return 'ja'; if (n.indexOf('ko') === 0) return 'ko'; if (n.indexOf('zh') === 0) return 'zh'; return 'en';
  }
  var L = pick();
  function t(k, v) {
    var row = D[k]; var i = LANGS.indexOf(L);
    var s = row ? (row[i] != null ? row[i] : row[0]) : k;
    if (v) for (var x in v) s = s.split('{' + x + '}').join(v[x]);
    return s;
  }
  function apply() {
    var de = document.documentElement;
    de.lang = L === 'zh' ? 'zh-Hant' : L; de.setAttribute('data-lang', L);
    document.querySelectorAll('[data-i]').forEach(function (e) { e.textContent = t(e.dataset.i); });
    document.querySelectorAll('[data-ih]').forEach(function (e) { e.innerHTML = t(e.dataset.ih); });
    document.querySelectorAll('[data-ip]').forEach(function (e) { e.placeholder = t(e.dataset.ip); });
    document.querySelectorAll('[data-ia]').forEach(function (e) { e.setAttribute('aria-label', t(e.dataset.ia)); });
    document.querySelectorAll('.langs button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.lang === L ? 'true' : 'false'); });
    document.title = t('doc_title');
    var md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute('content', t('doc_desc'));
    try { document.dispatchEvent(new CustomEvent('langchange', { detail: L })); } catch (e) {}
  }
  function set(l) { if (LANGS.indexOf(l) < 0) return; L = l; try { localStorage.setItem(KEY, l); } catch (e) {} apply(); }
  function bind() {
    document.querySelectorAll('.langs button').forEach(function (b) { b.addEventListener('click', function () { set(b.dataset.lang); }); });
    apply();
  }
  window.I18N = { t: t, set: set, apply: apply, get lang() { return L; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();
