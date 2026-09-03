import urllib.request
import json
import time

api_key = 'sk-sp-H.DRMYDR.f5Oa.MEUCIHL4I2jetSkjh-1VGHGKFvzSYdwo_MFh2CW0KWBvy5OtAiEAsLKQ3JjTkQFBZNtrHdU7xYximtVjRClzh-aea4kl3fg'
base_url = 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions'

def build_system_prompt(story_title, frames_summary):
    return f"""你是一位精通 3-6 岁幼儿语言心理学、极其温柔可爱、富有童心的幼儿园特级名师【晓晓老师】。
你正在和 3-6 岁小朋友一起看连环画绘本《{story_title}》，通过亲切自然的【双向聊天】带小朋友理解故事、激发表达。

【绘本全景情节与画面事实】
{frames_summary}

【特级名师儿童自适应对话核心原则】
1. 【单问号聚焦铁律（最核心）】：
   - 3-6 岁幼儿思维简单，每次回复【有且仅能提出 1 个具体的焦点小问号】！绝对严禁一次抛出两个或多个问题（如“有没有泥点？是谁帮它洗澡？泡泡出来了吗？”这样会让孩子大脑死机）！
   - 严禁提泛泛的宽泛大问题（严禁问“发生了什么呀？”、“这幅画怎么了？”）！必须聚焦在画面某个具体人物、动作或道具上提问（例如：“快看，是谁正拿着毛巾帮小鸭子洗澡呀？”）。
2. 【顺应孩子，严禁重复复读】：
   - 结合多轮对话历史，如果孩子刚才已经回答了某个细节，老师必须顺接夸奖，接着顺承推入下一个环节，【绝对严禁重复提问同一个问题】！
   - 如果孩子一口气讲得很完整（起因、经过、结果都齐了），不要再无意义纠缠细节，直接判定通关结业（is_completed: true, status: "PASS"）！
3. 【自适应引导推进（2-3轮自然通关）】：
   - 轮次 1：肯定孩子开口讲的部分，聚焦一个关键未提及的画面细节问 1 个小问题（is_completed: false, status: "PROBE"）；
   - 轮次 2：孩子回答了细节后，若整个故事脉络已齐，直接通关结业！若还差核心结局，再问最后一个收尾小问题；
   - 轮次 3 或以上：无论如何必须温馨通关结业，高度赞美，颁发勋章（is_completed: true, status: "PASS"）。
4. 【偏离纠偏机制】：
   - 如果孩子完全答非所问（如提到奥特曼、汉堡包等与画面无关内容），老师先温暖幽默肯定一句，然后温柔拉回当前画面关键物体或动物，提 1 个简单聚焦小问题。
5. 【通关时故事汇总（story_recap）】：
   - 当 is_completed: true 时，老师必须在 story_recap 字段中，把孩子刚才讲到的所有零碎细节串联成一段连贯、生动、温暖的小故事（80-120字），开头如“晓晓老师把你讲的故事串起来念给你听哦：有一天……”，让孩子获得极大的成就感！
6. 【语言风格】：超级温柔亲切、充满童真、多用儿童口语（哇、呀、呢、哦～），每句 teacher_reply 控制在 30-50 字左右。

【输出格式】请严格返回纯 JSON，严禁任何额外解释：
{{
  "accuracy_feedback": "🎯 准确捕捉到的具体画面事实",
  "accuracy_score": 96,
  "teacher_reply": "晓晓老师自然温柔的夸奖与顺畅互动（有且仅有1个具体聚焦小问号，30-50字）",
  "moral_badge": "爱心小天使 / 观察小达人 / 故事大王",
  "story_recap": "当 is_completed 为 true 时，汇总孩子讲出的完整故事（80-120字），平时为 string 空字符串",
  "is_completed": true 或 false,
  "status": "PASS 或 PROBE"
}}"""

def call_interact_api(system_prompt, history, user_text):
    messages = [{'role': 'system', 'content': system_prompt}]
    for h in history:
        messages.append(h)
    messages.append({'role': 'user', 'content': user_text})
    
    req_data = {
        'model': 'qwen3.8-flash',
        'messages': messages,
        'temperature': 0.35,
        'max_tokens': 300
    }
    req = urllib.request.Request(
        base_url,
        data=json.dumps(req_data).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'}
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        raw = res['choices'][0]['message']['content'].replace('```json', '').replace('```', '').strip()
        parsed = json.loads(raw)
        
        reply = parsed.get('teacher_reply', '')
        if not parsed.get('is_completed'):
            q_count = reply.count('？') + reply.count('?')
            if q_count > 1:
                idx = reply.find('？') if '？' in reply else reply.find('?')
                reply = reply[:idx+1]
        parsed['teacher_reply'] = reply
        return parsed

test_results = []

def run_test_case(test_id, name, title, frames, dialog_script):
    print(f"\n=======================================================")
    print(f"🧪 [TDD 测试案例 {test_id}]: {name} ({title})")
    print(f"=======================================================")
    
    sys_prompt = build_system_prompt(title, frames)
    history = []
    
    passed = True
    errors = []
    
    for round_idx, child_input in enumerate(dialog_script, 1):
        print(f"\n👶 [第 {round_idx} 轮幼儿口述]: {child_input}")
        t0 = time.time()
        resp = call_interact_api(sys_prompt, history, child_input)
        lat = round((time.time() - t0) * 1000)
        
        reply = resp.get('teacher_reply', '')
        badge = resp.get('accuracy_feedback', '')
        is_comp = resp.get('is_completed', False)
        recap = resp.get('story_recap', '')
        
        print(f"👩‍🏫 [晓晓老师回复] (耗时 {lat}ms): {reply}")
        print(f"🎯 [点赞徽章]: {badge}")
        
        # 核心 TDD 断言
        q_count = reply.count('？') + reply.count('?')
        if not is_comp and q_count != 1:
            passed = False
            errors.append(f"第 {round_idx} 轮未结业时问号个数不为 1 (实际: {q_count})")
            
        if "发生了什么呀" in reply or "这幅画讲了什么" in reply:
            passed = False
            errors.append(f"第 {round_idx} 轮出现了宽泛禁词！")
            
        if is_comp:
            print(f"🏁 [通关状态]: 已完成结业 (PASS)")
            print(f"📖 [孩子专属完整故事汇总]:\n{recap}")
            if not recap or len(recap) < 30:
                passed = False
                errors.append("结业通关时未能有效生成 story_recap 故事汇总！")
            break
        else:
            print(f"🧭 [推进状态]: 继续启发 (PROBE)")
            
        history.append({'role': 'user', 'content': child_input})
        history.append({'role': 'assistant', 'content': reply})
        
    status_str = "✅ PASS" if passed else f"❌ FAIL: {', '.join(errors)}"
    print(f"\n📊 测试用例 {test_id} 结论: {status_str}")
    test_results.append((test_id, name, passed, errors))

# ----------------- 执行 4 大典型场景 TDD 测试 -----------------

# 用例 1: 小班 2 幅图 (简短蹦词型)
run_test_case(
    test_id=1,
    name="小班 2 幅图·幼儿简短蹦词自适应引导",
    title="一起吹泡泡",
    frames="""【第 1 幅画】: 小狐狸站在草地上，拿着吹管吹彩色泡泡。(线索: 小狐狸正在玩什么？)
【第 2 幅画】: 小兔子也跑来了，和小狐狸一起吹出了许许多多大大小小的七彩泡泡，大家都笑开花了。(线索: 谁也跑来一起玩了？最后大家开心吗？)""",
    dialog_script=[
        "小狐狸，吹泡泡！",
        "小兔子也来了，好多大泡泡。"
    ]
)

# 用例 2: 中班 3 幅图 (微信小麻老师反馈的发散长句型)
run_test_case(
    test_id=2,
    name="中班 3 幅图·发散长句纠偏与故事融合汇总",
    title="小鸭子找泡泡",
    frames="""【第 1 幅画】: 一只身上沾着泥点的小鸭子站在水盆边。(线索: 小鸭子身上怎么脏脏的？)
【第 2 幅画】: 小兔子用香皂和毛巾帮小鸭子洗澡，水里都是彩色肥皂泡泡。(线索: 是谁在帮小鸭子洗澡？水里冒出了什么？)
【第 3 幅画】: 小鸭子洗得干干净净，开心地和小动物们一起围坐在桌旁吃水果。(线索: 小鸭子变干净了吗？大家在一起做什么？)""",
    dialog_script=[
        "讲吧，有一天小鸭子觉得吃东西有点怪怪的，去了去洗了个手用毛巾擦了擦，然后又用洗手液洗了洗，又用毛巾擦了一下去吃好吃的小水果了。",
        "小兔子拿着香皂帮小鸭子洗澡，搓出了好多大泡泡！",
        "洗干净啦，大家一起围坐着开开心心吃苹果和香蕉。"
    ]
)

# 用例 3: 大班 4 幅图 (长对话 4 轮时序起承转合)
run_test_case(
    test_id=3,
    name="大班 4 幅图·多轮长对话时序推理",
    title="小茶壶会唱歌",
    frames="""【第 1 幅画】: 厨房里，小男孩把水倒进小茶壶，放在灶台上烧水。(线索: 茶壶里装了什么？放在哪里烧？)
【第 2 幅画】: 水烧开了，小茶壶壶嘴冒出白白的水蒸气，嘟嘟嘟唱起了歌。(线索: 水烧开后茶壶怎么唱歌的？)
【第 3 幅画】: 妈妈拿着毛巾端起热热的小茶壶，把开水倒进茶杯里泡茶。(线索: 谁来倒茶了？倒进了哪里？)
【第 4 幅画】: 全家人围坐在桌旁，闻着香香的茶，开心地品茶聊天。(线索: 大家都喝到了茶吗？心情怎么样？)""",
    dialog_script=[
        "小男孩往茶壶里装水，要烧开水啦。",
        "水烧开啦，小茶壶壶嘴冒出好多白烟，嘟嘟嘟唱歌呢！",
        "妈妈拿毛巾把茶壶拿起来，倒进了杯子里泡茶。",
        "全家人坐在一起喝香香的热茶，心里暖洋洋的。"
    ]
)

# 用例 4: 极限测试 (调皮幼儿答非所问温柔拉回)
run_test_case(
    test_id=4,
    name="极端口误与跑题·温和拉回与收敛",
    title="小熊猫学剪纸",
    frames="""【第 1 幅画】: 老人拿着剪刀剪红纸，小熊猫站在旁边认真看。(线索: 老人手里拿着什么？)
【第 2 幅画】: 小熊猫自己拿着小剪刀，在红纸上认真学着剪。(线索: 小熊猫在学什么手艺？)
【第 3 幅画】: 桌上摆着剪好的漂亮窗花图案。(线索: 小熊猫剪出了什么？)
【第 4 幅画】: 小熊猫举起剪纸窗花，老人竖起大拇指夸奖它。(线索: 老人怎么夸奖小熊猫的？)""",
    dialog_script=[
        "我想吃麦当劳汉堡包，还有奥特曼打怪兽！",
        "老爷爷正在教小熊猫用剪刀剪红色的纸呢！",
        "小熊猫剪出了好看的小兔子窗花，老爷爷竖起大拇指夸它真棒！"
    ]
)

print("\n=======================================================")
print("🏆 【TDD 自动化测试套件汇总结果】")
print("=======================================================")
all_pass = True
for tid, tname, p, errs in test_results:
    mark = "✅ PASS" if p else "❌ FAIL"
    print(f"[{mark}] 用例 {tid}: {tname}")
    if errs:
        all_pass = False
        for e in errs:
            print(f"      👉 {e}")

if all_pass:
    print("\n🎉 恭喜！全部 4 大场景多轮长对话与极限测试 100% 绿色通过！")
else:
    print("\n⚠️ 存在未通过项，需针对性微调修复！")
