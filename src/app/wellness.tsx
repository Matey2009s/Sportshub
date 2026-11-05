import { Ionicons } from '@expo/vector-icons';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

type Message = { role: 'user' | 'assistant'; content: string };
const sources = [
  ['WHO · Tobacco and nicotine', 'https://www.who.int/news-room/fact-sheets/detail/tobacco'],
  ['WHO · Alcohol', 'https://www.who.int/news-room/fact-sheets/detail/alcohol'],
  ['CDC · Cannabis health effects', 'https://www.cdc.gov/cannabis/health-effects/'],
  ['WHO · Physical activity', 'https://www.who.int/news-room/fact-sheets/detail/physical-activity'],
  ['NHS · Alcohol and withdrawal', 'https://www.nhs.uk/conditions/alcohol-use-disorder/'],
  ['NHS · Blood tests', 'https://www.nhs.uk/tests-and-treatments/blood-tests/'],
];

export default function WellnessScreen() {
  const router = useRouter();
  const [isBg, setIsBg] = useState(true), [userId, setUserId] = useState('');
  const [loadingData, setLoadingData] = useState(true), [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false), [nudge, setNudge] = useState(true);
  const [draft, setDraft] = useState(''), [sending, setSending] = useState(false);
  const [error, setError] = useState(''), [messages, setMessages] = useState<Message[]>([]);
  const t = (bg: string, en: string) => isBg ? bg : en;

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace('/login'); return; }
    setUserId(auth.user.id);
    setIsBg((auth.user.user_metadata?.language ?? 'bg') !== 'en');
    const { data } = await supabase.from('wellness_intakes').select('user_id').eq('user_id', auth.user.id).maybeSingle();
    setSaved(Boolean(data)); setLoadingData(false);
  }, [router]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function deleteAnswers() {
    setDeleting(true);
    const { error: deleteError } = await supabase.from('wellness_intakes').delete().eq('user_id', userId);
    setDeleting(false);
    if (!deleteError) setSaved(false);
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    const previous = messages.slice(-8);
    setMessages((old) => [...old, { role: 'user', content: text }]);
    setDraft(''); setSending(true); setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('wellness-coach', {
        body: { message: text, history: previous },
      });
      if (invokeError) throw invokeError;
      if (typeof data?.reply !== 'string' || !data.reply.trim()) throw new Error(t('Асистентът не върна отговор. Опитай отново.', 'The assistant returned no reply.'));
      setMessages((old) => [...old, { role: 'assistant', content: data.reply }]);
    } catch (reason) {
      let message = t('AI функцията не е настроена. Провери дали е публикувана и дали OPENAI_API_KEY е добавен в Supabase → Edge Functions → Secrets.', 'The AI function is not configured. Check that it is deployed and OPENAI_API_KEY is set in Supabase → Edge Functions → Secrets.');
      if (reason instanceof FunctionsHttpError) {
        const status = Number(reason.context?.status ?? 0);
        try {
          const payload = await reason.context.json() as { error?: string };
          if (payload.error === 'AI_NOT_CONFIGURED') message = t('Липсва OPENAI_API_KEY в Supabase → Edge Functions → Secrets.', 'OPENAI_API_KEY is missing from Supabase → Edge Functions → Secrets.');
          else if (payload.error === 'OPENAI_KEY_INVALID') message = t('OpenAI ключът е невалиден. Провери OPENAI_API_KEY в Supabase Secrets.', 'The OpenAI key is invalid. Check OPENAI_API_KEY in Supabase Secrets.');
          else if (payload.error === 'OPENAI_RATE_LIMIT') message = t('OpenAI отказа заявката заради лимит или изчерпан баланс.', 'OpenAI rejected the request because of a rate limit or exhausted balance.');
          else if (payload.error && payload.error !== 'The assistant is temporarily unavailable. Please try again later.') message = payload.error;
          else if (status === 401) message = t('Сесията е изтекла. Излез от профила и влез отново.', 'Your session expired. Sign out and sign in again.');
          else if (status === 404) message = t('Supabase не намира wellness-coach. Публикувай функцията от правилната папка на проекта.', 'Supabase cannot find wellness-coach. Deploy the function from the correct project folder.');
          else if (status >= 500) message = t('AI функцията е достигната, но върна грешка. Провери Edge Function Logs в Supabase.', 'The AI function was reached but returned an error. Check Supabase Edge Function Logs.');
        } catch { /* Keep the helpful fallback if the function returned a non-JSON response. */ }
      } else if (reason instanceof FunctionsRelayError) {
        message = t('Supabase не успя да достигне wellness-coach. Провери дали функцията е публикувана.', 'Supabase could not reach wellness-coach. Check that the function is deployed.');
      } else if (reason instanceof FunctionsFetchError) {
        message = t('Няма връзка със Supabase. Провери интернет връзката и настройките на проекта.', 'Could not connect to Supabase. Check your internet connection and project settings.');
      } else if (reason instanceof Error && reason.message) {
        message = reason.message;
      }
      setError(message);
    } finally { setSending(false); }
  }

  return <SafeAreaView style={styles.screen} edges={['top']}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS==='ios'?'padding':undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Pressable onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)/profile')} style={styles.back}><Ionicons name="arrow-back" size={18} color="#FFF"/><ThemedText type="smallBold">{t('Профил','Profile')}</ThemedText></Pressable>
      {nudge ? <View style={styles.nudge}><Ionicons name="leaf-outline" size={21} color="#101714"/><View style={styles.nudgeCopy}><ThemedText type="smallBold" style={styles.nudgeTitle}>{t('Малките стъпки имат значение','Small steps matter')}</ThemedText><ThemedText type="small" style={styles.nudgeText}>{t('Грижата за себе си е уважение към себе си. Избери темпо, което ти пасва.','Caring for yourself is self-respect. Choose a pace that works for you.')}</ThemedText></View><Pressable onPress={()=>setNudge(false)} hitSlop={8}><Ionicons name="close" size={18} color="#263026"/></Pressable></View>:null}
      <View style={styles.heading}><ThemedText type="smallBold" style={styles.eyebrow}>{t('ТВОЯТА ЗОНА ЗА ВЪЗСТАНОВЯВАНЕ','YOUR RECOVERY SPACE')}</ThemedText><ThemedText type="title" style={styles.title}>SportHub {t('Здраве','Wellness')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('Проверена информация и реалистични стъпки — без осъждане.','Evidence-based information and realistic steps — without judgement.')}</ThemedText></View>

      <Pressable onPress={()=>router.push('/wellness-onboarding' as never)} style={styles.editAnswers}><Ionicons name="options-outline" size={18} color="#D7F36A"/><ThemedText type="smallBold" style={styles.editAnswersText}>{t('Обнови отговорите си','Update your answers')}</ThemedText><Ionicons name="arrow-forward" size={17} color="#D7F36A"/></Pressable>

      <View style={styles.section}>
        <SectionTitle icon="chatbubbles-outline" title={t('AI помощник за навици','AI habit coach')}/>
        <ThemedText type="small" themeColor="textSecondary">{t('Попитай за мотивация, спортен навик или как да подготвиш разговор с лекар. Не изпращай имена, адреси или лични данни.','Ask about motivation, activity habits, or preparing to speak with a clinician. Do not send names, addresses, or identifying details.')}</ThemedText>
        <View style={styles.chat}>
          {!messages.length ? <View style={[styles.message, styles.aiMessage]}><ThemedText type="small">{t('Здравей! Какво искаш да подобриш първо — спортната активност, съня или отказването от вреден навик?','Hi! What would you like to improve first — physical activity, sleep, or stopping a harmful habit?')}</ThemedText></View> : null}
          {messages.map((m,i)=><View key={String(i)} style={[styles.message,m.role==='user'?styles.userMessage:styles.aiMessage]}><ThemedText type="small" style={m.role==='user'?styles.userText:undefined}>{m.content}</ThemedText></View>)}
          {!!error?<ThemedText type="small" style={styles.error}>{error}</ThemedText>:null}
          {sending?<View style={styles.thinking}><ActivityIndicator size="small" color="#D7F36A"/><ThemedText type="small" themeColor="textSecondary">{t('Подготвям отговор…','Thinking…')}</ThemedText></View>:null}
          <View style={styles.composer}><TextInput value={draft} onChangeText={setDraft} placeholder={t('Напиши съобщение…','Write a message…')} placeholderTextColor="#879289" style={styles.input} multiline maxLength={2000} editable={!sending} onSubmitEditing={()=>void send()}/><Pressable onPress={()=>void send()} disabled={!draft.trim()||sending} accessibilityRole="button" style={[styles.send,(!draft.trim()||sending)&&styles.disabled]}><Ionicons name="arrow-up" size={20} color="#101714"/></Pressable></View>
        </View>
        <ThemedText type="small" themeColor="textSecondary">{t('AI асистентът не е лекар и не поставя диагнози. При спешност се обади на 112.','The AI assistant is not a clinician and does not diagnose. Call 112 in an emergency.')}</ThemedText>
      </View>
      <View style={styles.section}>
        <SectionTitle icon="sparkles-outline" title={t('Изгради навик постепенно','Build a habit gradually')}/>
        <Step n="01" title={t('Избери една малка цел','Choose one small goal')} body={t('Например 10 минути разходка или едно събитие тази седмица.','For example, a 10-minute walk or one event this week.')}/>
        <Step n="02" title={t('Подготви се за трудния момент','Plan for a difficult moment')} body={t('Забележи кога идва поривът и опитай алтернатива: разходка, вода, разговор или подкрепа.','Notice when a craving appears and try an alternative: a walk, water, a conversation, or support.')}/>
        <Step n="03" title={t('Потърси доверен специалист','Talk to a professional')} body={t('Личен лекар, фармацевт или специалист може да обсъди план според ситуацията ти.','A GP, pharmacist, or specialist can discuss a plan for your situation.')}/>
      </View>

      <View style={styles.section}>
        <SectionTitle icon="heart-outline" title={t('Какво е добре да знаеш','Useful health facts')}/>
        <Info title={t('Цигари, наргиле и никотин','Cigarettes, hookah, and nicotine')} body={t('Тютюневите изделия са вредни, а никотинът може да създаде зависимост. Наргилето не е безрисково. Вейпът също не е безвреден; много устройства съдържат никотин.','Tobacco products are harmful, and nicotine can cause dependence. Hookah is not risk-free. Vaping is not harmless either; many devices contain nicotine.')}/>
        <Info title={t('Канабис','Cannabis')} body={t('Може да повлияе на паметта, вниманието, координацията и реакциите. Пушенето може да увреди белодробната тъкан. Не шофирай след употреба.','It can affect memory, attention, coordination, and reaction time. Smoking can harm lung tissue. Do not drive after use.')}/>
        <Info title={t('Алкохол','Alcohol')} body={t('Свързан е с рискове за черния дроб, сърцето, някои видове рак и психичното здраве. Рискът зависи от човека и начина на употреба.','It is associated with risks to the liver, heart, some cancers, and mental health. Risk varies by person and pattern of use.')}/>
        <View style={styles.warning}><Ionicons name="warning-outline" size={18} color="#FFD27C"/><ThemedText type="small" style={styles.warningText}>{t('При редовно пиене и треперене, изпотяване, гадене или силна тревожност при пропускане не спирай рязко сам/а — потърси медицинска помощ. Гърчове, объркване или халюцинации са спешен случай: 112.','If you drink regularly and get shaking, sweating, nausea, or severe anxiety when you miss a drink, do not stop suddenly on your own—seek medical help. Seizures, confusion, or hallucinations are an emergency: call 112.')}</ThemedText></View>
      </View>

      <View style={styles.section}>
        <SectionTitle icon="pulse-outline" title={t('Хормони и изследвания','Hormones and tests')}/>
        <ThemedText type="small" themeColor="textSecondary" style={styles.body}>{t('Хормоните участват в съня, енергията и много други процеси, но умората или промяна в теглото могат да имат различни причини. Няма универсален хормонален пакет за всеки. Запиши симптомите и ги обсъди с лекар, който ще прецени дали и кои изследвания са нужни.','Hormones affect sleep, energy, and many other processes, but fatigue or weight changes can have many causes. There is no universal hormone panel for everyone. Note your symptoms and discuss them with a clinician, who can decide whether tests are appropriate.')}</ThemedText>
      </View>

      <View style={styles.section}>
        <SectionTitle icon="book-outline" title={t('Проверени източници','Trusted sources')}/>
        {sources.map(([name,url])=><Pressable key={url} onPress={()=>void Linking.openURL(url)} style={styles.source}><ThemedText type="smallBold" style={styles.sourceText}>{name}</ThemedText><Ionicons name="open-outline" size={15} color="#D7F36A"/></Pressable>)}
      </View>



      {saved?<View style={styles.saved}><View style={styles.savedCopy}><ThemedText type="smallBold">{t('Запазени лични отговори','Saved private answers')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('Изтрий ги по всяко време.','Delete them at any time.')}</ThemedText></View><Pressable onPress={()=>void deleteAnswers()} disabled={deleting} style={styles.delete}><Ionicons name={deleting?'hourglass-outline':'trash-outline'} size={18} color="#FF9AAB"/></Pressable></View>:null}
      {loadingData?<ActivityIndicator size="small" color="#D7F36A"/>:null}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}

function SectionTitle({icon,title}:{icon:keyof typeof Ionicons.glyphMap;title:string}) { return <View style={styles.sectionHead}><Ionicons name={icon} size={20} color="#D7F36A"/><ThemedText type="smallBold" style={styles.sectionTitle}>{title}</ThemedText></View>; }
function Step({n,title,body}:{n:string;title:string;body:string}) { return <View style={styles.step}><View style={styles.stepN}><ThemedText type="smallBold" style={styles.stepNText}>{n}</ThemedText></View><View style={styles.stepCopy}><ThemedText type="smallBold">{title}</ThemedText><ThemedText type="small" themeColor="textSecondary">{body}</ThemedText></View></View>; }
function Info({title,body}:{title:string;body:string}) { return <View style={styles.info}><ThemedText type="smallBold">{title}</ThemedText><ThemedText type="small" themeColor="textSecondary">{body}</ThemedText></View>; }

const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#0B1110'},flex:{flex:1},content:{width:'100%',maxWidth:760,alignSelf:'center',padding:18,paddingBottom:48,gap:14},
 editAnswers:{minHeight:48,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:14,borderRadius:15,borderWidth:1,borderColor:'#47385A',backgroundColor:'rgba(130,87,176,0.16)'},editAnswersText:{flex:1,color:'#E9D8FF'},
 back:{minHeight:42,alignSelf:'flex-start',flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,borderRadius:999,backgroundColor:'rgba(255,255,255,0.06)'},
 nudge:{flexDirection:'row',alignItems:'flex-start',gap:10,padding:13,borderRadius:17,backgroundColor:'#D7F36A'},nudgeCopy:{flex:1,gap:3},nudgeTitle:{color:'#101714'},nudgeText:{color:'#263026'},
 heading:{gap:8,paddingVertical:4},eyebrow:{color:'#D7F36A',fontSize:10,letterSpacing:1.4},title:{fontSize:31,lineHeight:38},
 section:{gap:12,padding:16,borderRadius:21,borderWidth:1,borderColor:'#2D3932',backgroundColor:'#151D1B'},sectionHead:{flexDirection:'row',alignItems:'center',gap:9},sectionTitle:{fontSize:16,flex:1},
 step:{flexDirection:'row',alignItems:'flex-start',gap:10},stepN:{width:34,height:34,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:'rgba(215,243,106,0.12)'},stepNText:{color:'#D7F36A'},stepCopy:{flex:1,gap:3,paddingTop:2},
 info:{gap:5,padding:13,borderRadius:15,backgroundColor:'#101714'},warning:{flexDirection:'row',alignItems:'flex-start',gap:9,padding:12,borderRadius:14,backgroundColor:'rgba(255,210,124,0.09)'},warningText:{flex:1,lineHeight:20},body:{lineHeight:21},
 source:{minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:11,borderRadius:12,backgroundColor:'#101714'},sourceText:{color:'#D7F36A',flex:1},
 chat:{gap:10,padding:12,borderRadius:17,backgroundColor:'#101714',borderWidth:1,borderColor:'#2D3932'},message:{maxWidth:'91%',paddingHorizontal:12,paddingVertical:9,borderRadius:15},userMessage:{alignSelf:'flex-end',backgroundColor:'#D7F36A'},aiMessage:{alignSelf:'flex-start',backgroundColor:'#202A26'},userText:{color:'#101714'},
 composer:{flexDirection:'row',alignItems:'flex-end',gap:8,marginTop:4},input:{flex:1,minHeight:44,maxHeight:110,color:'#FFF',paddingHorizontal:12,paddingVertical:10,borderRadius:14,backgroundColor:'#1A231F',fontSize:14},send:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:14,backgroundColor:'#D7F36A'},
 thinking:{flexDirection:'row',alignItems:'center',gap:8},error:{color:'#FF9AAB'},disabled:{opacity:0.5},
 saved:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:17,borderWidth:1,borderColor:'#3C303A',backgroundColor:'#17131B'},savedCopy:{flex:1,gap:4},delete:{width:44,height:44,alignItems:'center',justifyContent:'center',borderRadius:13,backgroundColor:'rgba(255,110,140,0.12)'},
});
