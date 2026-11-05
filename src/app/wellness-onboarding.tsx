import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

type Choice = 'yes' | 'no' | 'prefer_not_to_say';
type Awareness = 'yes' | 'no' | 'not_sure';
const products = [
  { id: 'cigarettes', bg: 'Цигари', en: 'Cigarettes' }, { id: 'cannabis', bg: 'Канабис', en: 'Cannabis' },
  { id: 'hookah', bg: 'Наргиле', en: 'Hookah' }, { id: 'vape', bg: 'Вейп', en: 'Vape' },
  { id: 'heated_tobacco', bg: 'Нагреваем тютюн', en: 'Heated tobacco' },
];

export default function WellnessOnboardingScreen() {
  const router = useRouter();
  const [isBg, setIsBg] = useState(true), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [tobacco, setTobacco] = useState<Choice | null>(null);
  const [alcohol, setAlcohol] = useState<Choice | null>(null), [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [awareness, setAwareness] = useState<Awareness | null>(null), [consent, setConsent] = useState(false);
  const t = (bg: string, en: string) => isBg ? bg : en;
  const uses = tobacco === 'yes' || alcohol === 'yes';
  const canContinue = tobacco !== null && alcohol !== null && (!uses || awareness !== null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return; }
      setIsBg((data.user.user_metadata?.language ?? 'bg') !== 'en'); setLoading(false);
    }).catch(() => { setError('Не успяхме да проверим профила ти.'); setLoading(false); });
  }, [router]);

  function toggleProduct(id: string) {
    setSelectedProducts((old) => old.includes(id) ? old.filter((x) => x !== id) : [...old, id]);
  }

  async function finish(skip = false) {
    setError(''); setSaving(true);
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) throw new Error(t('Влез отново, за да продължиш.', 'Sign in again to continue.'));
      if (!skip && consent) {
        if (!canContinue) throw new Error(t('Отговори или избери „Предпочитам да не казвам“.', 'Answer or choose “Prefer not to say”.'));
        const { error: saveError } = await supabase.from('wellness_intakes').upsert({
          user_id: data.user.id, tobacco_response: tobacco, smoke_products: tobacco === 'yes' ? selectedProducts : [],
          alcohol_response: alcohol, awareness: uses ? awareness : null,
          consented_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        });
        if (saveError) throw saveError;
      }
      await supabase.auth.updateUser({ data: { wellness_onboarding_seen_at: new Date().toISOString() } });
      router.replace('/wellness' as never);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('Не успяхме да запазим избора ти.', 'Could not save your choice.'));
    } finally { setSaving(false); }
  }

  if (loading) return <SafeAreaView style={styles.center} edges={['top']}><ActivityIndicator color="#D7F36A" /><ThemedText>{t('Зареждане…', 'Loading…')}</ThemedText></SafeAreaView>;

  return <SafeAreaView style={styles.screen} edges={['top']}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.hero}>
      <View style={styles.icon}><Ionicons name="heart-half-outline" size={23} color="#101714" /></View>
      <ThemedText type="smallBold" style={styles.eyebrow}>{t('ЗДРАВЕ И СПОРТ', 'WELLNESS & MOVEMENT')}</ThemedText>
      <ThemedText type="title" style={styles.title}>{t('Твоето темпо. Твоят избор.', 'Your pace. Your choice.')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('Доброволни въпроси, за да покажем подходяща информация и подкрепа.', 'Optional questions to show relevant information and support.')}</ThemedText>
    </View>
    <View style={styles.privacy}><Ionicons name="lock-closed-outline" size={18} color="#D7F36A" /><ThemedText type="small" style={styles.privacyText}>{t('Не е нужно да отговаряш. Отговорите се запазват в личния ти профил само с отделното ти съгласие.', 'You can skip these questions. Answers are saved to your private account only with your separate consent.')}</ThemedText></View>
    <View style={styles.card}>
      <ThemedText type="smallBold" style={styles.question}>{t('Употребяваш ли цигари, канабис/марихуана, наргиле, вейп или нагреваем тютюн?', 'Do you use cigarettes, cannabis, hookah, vapes, or heated tobacco?')}</ThemedText>
      <View style={styles.row}><ChoiceButton label={t('Да','Yes')} active={tobacco==='yes'} onPress={()=>setTobacco('yes')} /><ChoiceButton label={t('Не','No')} active={tobacco==='no'} onPress={()=>{setTobacco('no');setSelectedProducts([]);}} /><ChoiceButton label={t('Предпочитам да не казвам','Prefer not to say')} active={tobacco==='prefer_not_to_say'} onPress={()=>{setTobacco('prefer_not_to_say');setSelectedProducts([]);}} /></View>
      {tobacco==='yes' ? <><ThemedText type="small" themeColor="textSecondary">{t('Избери всички приложими:', 'Select all that apply:')}</ThemedText><View style={styles.row}>{products.map(p=><ChoiceButton key={p.id} label={t(p.bg,p.en)} active={selectedProducts.includes(p.id)} onPress={()=>toggleProduct(p.id)} />)}</View></> : null}
    </View>
    <View style={styles.card}>
      <ThemedText type="smallBold" style={styles.question}>{t('Консумираш ли алкохол?', 'Do you drink alcohol?')}</ThemedText>
      <View style={styles.row}><ChoiceButton label={t('Да','Yes')} active={alcohol==='yes'} onPress={()=>setAlcohol('yes')} /><ChoiceButton label={t('Не','No')} active={alcohol==='no'} onPress={()=>setAlcohol('no')} /><ChoiceButton label={t('Предпочитам да не казвам','Prefer not to say')} active={alcohol==='prefer_not_to_say'} onPress={()=>setAlcohol('prefer_not_to_say')} /></View>
    </View>
    {uses ? <View style={styles.card}>
      <ThemedText type="smallBold" style={styles.question}>{t('Запознат/а ли си с възможното влияние върху здравето?', 'Are you familiar with possible health effects?')}</ThemedText>
      <View style={styles.row}><ChoiceButton label={t('Да','Yes')} active={awareness==='yes'} onPress={()=>setAwareness('yes')} /><ChoiceButton label={t('Не','No')} active={awareness==='no'} onPress={()=>setAwareness('no')} /><ChoiceButton label={t('Не съм сигурен/на','Not sure')} active={awareness==='not_sure'} onPress={()=>setAwareness('not_sure')} /></View>
      {awareness ? <View style={styles.fact}><ThemedText type="smallBold">{t('Накратко', 'In brief')}</ThemedText><ThemedText type="small" themeColor="textSecondary">{t('Тютюнът и никотинът могат да увредят сърцето и белите дробове и да създадат зависимост. Алкохолът носи здравни рискове; при зависимост рязкото спиране може да е опасно. В SportHub Здраве има проверена информация и варианти за подкрепа.', 'Tobacco and nicotine can harm the heart and lungs and cause dependence. Alcohol carries health risks; sudden stopping can be dangerous with dependence. SportHub Wellness has verified information and support options.')}</ThemedText></View> : null}
    </View> : null}
    <Pressable onPress={()=>setConsent(!consent)} accessibilityRole="checkbox" accessibilityState={{checked:consent}} style={styles.consent}>
      <View style={[styles.check,consent&&styles.checked]}>{consent?<Ionicons name="checkmark" size={15} color="#101714"/>:null}</View>
      <ThemedText type="small" style={styles.consentText}>{t('Съгласен/на съм отговорите да се запазят в личния ми профил. Мога да ги изтрия по всяко време.', 'I agree to save answers to my private account. I can delete them at any time.')}</ThemedText>
    </Pressable>
    {!!error ? <ThemedText type="small" style={styles.error}>{error}</ThemedText> : null}
    <Pressable onPress={()=>void finish(false)} disabled={saving||!canContinue} style={[styles.primary,(saving||!canContinue)&&styles.disabled]} accessibilityRole="button">
      {saving?<ActivityIndicator color="#101714"/>:<><ThemedText type="smallBold" style={styles.primaryText}>{t('Продължи към SportHub Здраве','Continue to SportHub Wellness')}</ThemedText><Ionicons name="arrow-forward" size={18} color="#101714"/></>}
    </Pressable>
    <Pressable onPress={()=>void finish(true)} disabled={saving} style={styles.skip} accessibilityRole="button"><ThemedText type="smallBold" style={styles.skipText}>{t('Пропусни и продължи','Skip and continue')}</ThemedText></Pressable>
    <ThemedText type="small" themeColor="textSecondary" style={styles.disclaimer}>{t('SportHub предлага обща образователна информация, не диагностика или лечение.', 'SportHub provides general education, not diagnosis or treatment.')}</ThemedText>
  </ScrollView></SafeAreaView>;
}

function ChoiceButton({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{selected:active}} style={[styles.choice,active&&styles.choiceOn]}><ThemedText type="smallBold" style={active?styles.choiceOnText:styles.choiceText}>{label}</ThemedText></Pressable>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:'#0B1110'},center:{flex:1,alignItems:'center',justifyContent:'center',gap:12,backgroundColor:'#0B1110'},
  content:{width:'100%',maxWidth:680,alignSelf:'center',padding:20,paddingBottom:48,gap:14},hero:{gap:10,paddingVertical:8},
  icon:{width:48,height:48,borderRadius:17,backgroundColor:'#D7F36A',alignItems:'center',justifyContent:'center'},
  eyebrow:{color:'#D7F36A',letterSpacing:1.4,fontSize:10},title:{fontSize:31,lineHeight:37},
  privacy:{flexDirection:'row',alignItems:'flex-start',gap:10,padding:14,borderRadius:16,backgroundColor:'#18211C',borderWidth:1,borderColor:'#334236'},privacyText:{flex:1,flexShrink:1,lineHeight:22},
  card:{padding:16,gap:12,borderRadius:20,borderWidth:1,borderColor:'#2D3932',backgroundColor:'#151D1B'},question:{fontSize:16,lineHeight:22},
  row:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{minHeight:44,alignItems:'center',justifyContent:'center',paddingHorizontal:11,borderRadius:13,borderWidth:1,borderColor:'#3B4940',backgroundColor:'#101714'},
  choiceOn:{backgroundColor:'#D7F36A',borderColor:'#D7F36A'},choiceText:{color:'#E9F1E8',fontSize:12},choiceOnText:{color:'#101714',fontSize:12},
  fact:{gap:6,padding:13,borderRadius:14,backgroundColor:'rgba(215,243,106,0.08)'},consent:{minHeight:56,flexDirection:'row',alignItems:'center',gap:11,padding:5},
  consentText:{flex:1,flexShrink:1,lineHeight:22},check:{width:24,height:24,borderRadius:7,borderWidth:1,borderColor:'#72806F',alignItems:'center',justifyContent:'center'},checked:{backgroundColor:'#D7F36A',borderColor:'#D7F36A'},
  error:{color:'#FF9AAB',padding:10,backgroundColor:'rgba(255,100,110,0.12)',borderRadius:12},
  primary:{minHeight:54,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9,padding:14,borderRadius:16,backgroundColor:'#D7F36A'},
  primaryText:{color:'#101714'},skip:{minHeight:46,alignItems:'center',justifyContent:'center'},skipText:{color:'#D7F36A'},
  disclaimer:{textAlign:'center',lineHeight:18},disabled:{opacity:0.5},
});
