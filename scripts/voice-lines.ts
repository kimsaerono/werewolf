/** 固定播报文案 → EmotiVoice 生成配置（voice=音色ID，prompt=情感/风格提示） */
export interface VoiceLine {
  id: string
  text: string
  voice: string
  prompt: string
}

export const VOICE_LINES: VoiceLine[] = [
  { id: "night_start", text: "天黑请闭眼。", voice: "8051", prompt: "Calm, gentle announcer" },
  { id: "cupid", text: "丘比特请睁眼，指认你选定的两位情侣。", voice: "8051", prompt: "Mysterious, playful" },
  { id: "cupid_close", text: "丘比特请闭眼。", voice: "8051", prompt: "Calm" },
  { id: "wolf", text: "狼崽子睁眼，认认你的同伙，商量今晚刀谁。", voice: "8051", prompt: "Evil, low whisper" },
  { id: "wolf_close", text: "狼人请闭眼。", voice: "8051", prompt: "Calm" },
  { id: "wolf_king_gesture", text: "狼王、白狼王请举手示意，法官确认！", voice: "8051", prompt: "Formal" },
  { id: "prophet", text: "预言家请睁眼，查验一位玩家的身份。", voice: "8051", prompt: "Serious, solemn" },
  { id: "prophet_close", text: "预言家请闭眼。", voice: "8051", prompt: "Calm" },
  { id: "guard", text: "守卫请睁眼，选择你要守护的玩家。", voice: "8051", prompt: "Steady, protective" },
  { id: "guard_close", text: "守卫请闭眼。", voice: "8051", prompt: "Calm" },
  { id: "witch", text: "女巫请睁眼，今晚被刀的是某玩家，救不救？", voice: "8051", prompt: "Urgent, mysterious" },
  { id: "witch_close", text: "女巫请闭眼。", voice: "8051", prompt: "Calm" },
  { id: "knight", text: "骑士请睁眼，确认你的决斗之剑。", voice: "8051", prompt: "Heroic" },
  { id: "knight_close", text: "骑士请闭眼。", voice: "8051", prompt: "Calm" },
  { id: "hunter_open", text: "猎人请睁眼，确认你的枪状态。", voice: "8051", prompt: "Bold" },
  { id: "hunter_close", text: "猎人请闭眼。", voice: "8051", prompt: "Calm" },
  { id: "idiot_open", text: "白痴请睁眼，确认身份。", voice: "8051", prompt: "Silly, goofy" },
  { id: "idiot_close", text: "白痴请闭眼。", voice: "8051", prompt: "Calm" },
  { id: "dawn", text: "天亮了，请睁眼！", voice: "8051", prompt: "Cheerful, bright" },
  { id: "dawn_peace", text: "天亮了，昨晚是平安夜！", voice: "8051", prompt: "Cheerful, relieved" },
  { id: "vote", text: "现在是投票环节，请投出你怀疑的人。", voice: "8051", prompt: "Neutral" },
  { id: "explode", text: "狼人自爆！直接摆烂摊牌，白天结束。", voice: "8051", prompt: "Angry, dramatic" },
  { id: "wwk_boom", text: "白狼王掀桌自爆！顺手薅走一个。", voice: "8051", prompt: "Angry, explosive" },
  { id: "hunter", text: "猎枪已上膛，逮个倒霉蛋过来陪葬！", voice: "8051", prompt: "Bold, fierce" },
  { id: "hunter_poisoned", text: "毒药把枪腐蚀锈死，彻底哑火开不了。", voice: "8051", prompt: "Sad, defeated" },
  { id: "idiot_flip", text: "显眼包亮身份赖场不走！", voice: "8051", prompt: "Funny, cheeky" },
  { id: "knight_duel_wolf", text: "骑士一剑戳中大灰狼！", voice: "8051", prompt: "Triumphant" },
  { id: "knight_duel_good", text: "骑士看走眼翻车，自己白给。", voice: "8051", prompt: "Shocked, regretful" },
  { id: "jinghui", text: "现在竞选警长。", voice: "8051", prompt: "Formal" },
  { id: "wolfkingShot", text: "狼王出局，可以开枪带走一人。", voice: "8051", prompt: "Bold" },
  { id: "prophetReport", text: "竞选警长结束，请公布首夜情况。", voice: "8051", prompt: "Formal" },
  { id: "speech", text: "开始发言。", voice: "8051", prompt: "Neutral" },
]
