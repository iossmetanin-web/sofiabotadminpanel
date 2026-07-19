'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Users, MessageCircle, Sparkles, Gem, TrendingUp, Activity, Send,
  Bot, Heart, Moon, Star, Zap, ScrollText, CircleCheck, CircleAlert, RefreshCw,
  Flame, Crown, Calendar, Mail, Globe, Languages, Gift, ArrowUpRight, Clock,
  Sparkle, Layers, Eye,
} from 'lucide-react';
import { Sparkline, BarSparkline } from '@/components/sofia/Sparkline';
import { ZodiacWheel } from '@/components/sofia/ZodiacWheel';
import { ZODIAC_EMOJI } from '@/components/sofia/zodiac-data';

type Stats = {
  users: { total: number; active24h: number; active7d: number; onboarded: number; blocked: number };
  activity: { totalMessages: number; totalReadings: number; broadcasts: number };
  economy: { crystalsSpent: number; crystalsInCirculation: number };
  funnel: { conversion: number; retention7d: number };
  readingsByType: { type: string; count: number }[];
};

type UserRow = {
  id: string; telegramId: string; username: string | null; firstName: string | null;
  name: string | null; language: string;
  zodiacSign: string | null; onboardingCompleted: boolean;
  onboardingStep: string; crystals: number; messageCount: number; streakDays: number;
  isBlocked: boolean; isAdmin: boolean; lastSeenAt: string | null; createdAt: string;
};

type ReadingRow = {
  id: string; type: string; question: string | null; cards: string;
  interpretation: string; cost: number; createdAt: string;
  user: { name: string | null; username: string | null; firstName: string | null; zodiacSign: string | null };
};

type BroadcastRow = {
  id: string; text: string; sentCount: number; failedCount: number; total: number;
  status: string; createdAt: string;
  user: { username: string | null; firstName: string | null } | null;
};

type ActivityBucket = {
  date: string; messages: number; sofiaMsgs: number; userMsgs: number;
  readings: number; newUsers: number; crystalsSpent: number;
};

type StreakData = {
  topStreaks: { id: string; name: string; username: string | null; zodiacSign: string | null; streakDays: number; lastSeenAt: string | null }[];
  distribution: { bucket: string; count: number }[];
  dailyActive: { date: string; count: number }[];
  cardOfDayActiveUsers: number;
};

type ReferralData = {
  leaderboard: { rank: number; referrer: { name: string | null; firstName: string | null; username: string | null; zodiacSign: string | null; createdAt: string } | null; referrals: number }[];
  totals: { totalReferrals: number; rewardedReferrals: number; usersWithReferrer: number; crystalsAwarded: number };
};

type DigestData = {
  weekRange: { from: string; to: string };
  lastSentAt: string | null;
  stats: { newUsers: number; active7d: number; messages: number; readings: number; crystalsSpent: number };
  topUsers: { id: string; name: string; username: string | null; zodiacSign: string | null; messageCount: number; streakDays: number }[];
  readingsByType: { type: string; count: number }[];
  recentBroadcasts: { id: string; text: string; status: string; sentCount: number; failedCount: number; total: number; createdAt: string }[];
};

const READING_LABELS: Record<string, string> = {
  fate_card: '🌟 Карта судьбы', tarot_small: '🃏 Малый', tarot_full: '🌑 Полный',
  tarot_love: '💑 Любовный', tarot_career: '💼 Карьера', tarot_decision: '🛤 Решение',
  horoscope: '♈ Гороскоп', single_card: '🃏 Одна карта', card_of_day: '🌙 Карта дня',
};

const READING_COLORS: Record<string, string> = {
  fate_card: '#f59e0b', tarot_small: '#a78bfa', tarot_full: '#60a5fa',
  tarot_love: '#f472b6', tarot_career: '#34d399', tarot_decision: '#fb923c',
  horoscope: '#facc15', single_card: '#94a3b8', card_of_day: '#c084fc',
};

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} дн назад`;
  return new Date(iso).toLocaleDateString('ru-RU');
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export default function Page() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [readings, setReadings] = useState<ReadingRow[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [activity, setActivity] = useState<ActivityBucket[]>([]);
  const [streaks, setStreaks] = useState<StreakData | null>(null);
  const [referrals, setReferrals] = useState<ReferralData | null>(null);
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [botStatus, setBotStatus] = useState<{ ok: boolean; username?: string; lastHeartbeat?: string; ageSeconds?: number; error?: string } | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [broadcastText, setBroadcastText] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchStats = useCallback(async () => {
    setLoading((l) => ({ ...l, stats: true }));
    try { const res = await fetch('/api/stats'); const data = await res.json(); setStats(data); }
    catch (e: any) { toast.error('Не загрузилась статистика: ' + e.message); }
    finally { setLoading((l) => ({ ...l, stats: false })); }
  }, []);

  const fetchUsers = useCallback(async (page: number, s: string) => {
    setLoading((l) => ({ ...l, users: true }));
    try {
      const res = await fetch(`/api/users?page=${page}&search=${encodeURIComponent(s)}`);
      const data = await res.json();
      setUsers(data.users); setUsersTotal(data.total); setUsersPage(data.page); setUsersTotalPages(data.totalPages);
    } catch { toast.error('Не загрузились пользователи'); }
    finally { setLoading((l) => ({ ...l, users: false })); }
  }, []);

  const fetchReadings = useCallback(async () => {
    setLoading((l) => ({ ...l, readings: true }));
    try { const res = await fetch('/api/readings?limit=20'); const data = await res.json(); setReadings(data.readings); }
    catch { toast.error('Не загрузились расклады'); }
    finally { setLoading((l) => ({ ...l, readings: false })); }
  }, []);

  const fetchBroadcasts = useCallback(async () => {
    setLoading((l) => ({ ...l, broadcasts: true }));
    try { const res = await fetch('/api/broadcasts'); const data = await res.json(); setBroadcasts(data.broadcasts); }
    catch { toast.error('Не загрузились рассылки'); }
    finally { setLoading((l) => ({ ...l, broadcasts: false })); }
  }, []);

  const fetchActivity = useCallback(async () => {
    setLoading((l) => ({ ...l, activity: true }));
    try { const res = await fetch('/api/activity?days=14'); const data = await res.json(); setActivity(data.buckets ?? []); }
    catch { /* silent */ }
    finally { setLoading((l) => ({ ...l, activity: false })); }
  }, []);

  const fetchStreaks = useCallback(async () => {
    setLoading((l) => ({ ...l, streaks: true }));
    try { const res = await fetch('/api/streaks'); const data = await res.json(); setStreaks(data); }
    catch { /* silent */ }
    finally { setLoading((l) => ({ ...l, streaks: false })); }
  }, []);

  const fetchReferrals = useCallback(async () => {
    setLoading((l) => ({ ...l, referrals: true }));
    try { const res = await fetch('/api/referrals'); const data = await res.json(); setReferrals(data); }
    catch { /* silent */ }
    finally { setLoading((l) => ({ ...l, referrals: false })); }
  }, []);

  const fetchDigest = useCallback(async () => {
    setLoading((l) => ({ ...l, digest: true }));
    try { const res = await fetch('/api/digest'); const data = await res.json(); setDigest(data); }
    catch { /* silent */ }
    finally { setLoading((l) => ({ ...l, digest: false })); }
  }, []);

  const fetchBotStatus = useCallback(async () => {
    setLoading((l) => ({ ...l, bot: true }));
    try { const res = await fetch('/api/bot/status'); const data = await res.json(); setBotStatus(data); }
    catch { setBotStatus({ ok: false, error: 'недоступен' }); }
    finally { setLoading((l) => ({ ...l, bot: false })); }
  }, []);

  useEffect(() => { fetchStats(); fetchBotStatus(); fetchActivity(); }, [fetchStats, fetchBotStatus, fetchActivity]);
  useEffect(() => { fetchUsers(1, ''); }, [fetchUsers]);
  useEffect(() => { fetchReadings(); fetchBroadcasts(); }, [fetchReadings, fetchBroadcasts]);

  // Lazy-load tab data on tab change.
  useEffect(() => {
    if (activeTab === 'streaks' && !streaks) fetchStreaks();
    if (activeTab === 'digest' && !digest) fetchDigest();
    if (activeTab === 'overview' && !referrals) fetchReferrals();
  }, [activeTab, streaks, digest, referrals, fetchStreaks, fetchDigest, fetchReferrals]);

  // Auto-refresh bot status every 30s.
  useEffect(() => {
    const t = setInterval(() => { fetchBotStatus(); }, 30_000);
    return () => clearInterval(t);
  }, [fetchBotStatus]);

  const onSearch = (v: string) => { setSearch(v); fetchUsers(1, v); };

  const sendBroadcast = async () => {
    if (!broadcastText.trim()) { toast.error('Введите текст рассылки'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/broadcasts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: broadcastText }),
      });
      const data = await res.json();
      if (res.ok) { toast.success(`Рассылка запущена (id: ${data.id}, получателей: ${data.total})`); setBroadcastText(''); fetchBroadcasts(); }
      else { toast.error(data.error ?? 'Ошибка'); }
    } catch (e: any) { toast.error('Не удалось отправить: ' + e.message); }
    finally { setSending(false); }
  };

  // Derived: zodiac counts from users (best-effort).
  const zodiacCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const u of users) if (u.zodiacSign) m[u.zodiacSign] = (m[u.zodiacSign] ?? 0) + 1;
    return m;
  }, [users]);

  // Derived: sparkline data for activity.
  const msgSpark = activity.map((b) => b.messages);
  const readingsSpark = activity.map((b) => b.readings);
  const newUsersSpark = activity.map((b) => b.newUsers);
  const crystalsSpark = activity.map((b) => b.crystalsSpent);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
        {/* Header */}
        <header className="sticky top-0 z-50 border-b border-amber-900/30 bg-stone-950/85 backdrop-blur-xl">
          <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-11 h-11 rounded-full bg-gradient-to-br from-amber-600 via-amber-800 to-stone-900 flex items-center justify-center text-xl shadow-lg shadow-amber-900/40 sofia-glow">
                <span className="sofia-float">🔮</span>
              </div>
              <div>
                <h1 className="font-serif text-xl font-semibold tracking-tight leading-none">София</h1>
                <p className="text-xs text-stone-400 mt-0.5">мудрая ведунья · @{botStatus?.username ?? 'oracultetris_bot'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant={botStatus?.ok ? 'default' : 'destructive'} className="gap-1.5 px-2.5 py-1 text-xs">
                    {botStatus?.ok ? <CircleCheck className="w-3 h-3" /> : <CircleAlert className="w-3 h-3" />}
                    {loading.bot ? '…' : botStatus?.ok ? `Онлайн · ${botStatus.ageSeconds ?? 0}s` : 'Оффлайн'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {botStatus?.lastHeartbeat ? `Heartbeat: ${new Date(botStatus.lastHeartbeat).toLocaleString('ru-RU')}` : 'Нет данных'}
                </TooltipContent>
              </Tooltip>
              <Button variant="outline" size="sm" onClick={() => { fetchStats(); fetchBotStatus(); fetchActivity(); }} className="border-stone-700 text-stone-300 hover:bg-stone-800 hover:text-amber-200">
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading.stats || loading.bot ? 'animate-spin' : ''}`} /> Обновить
              </Button>
              <Button asChild size="sm" className="bg-gradient-to-br from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-stone-50 shadow-md shadow-amber-900/30">
                <a href="https://t.me/oracultetris_bot" target="_blank" rel="noreferrer">
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Открыть
                </a>
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 py-8 space-y-10">
          {/* Hero / Landing */}
          <section className="relative overflow-hidden rounded-3xl border border-amber-900/40 bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/40 p-8 md:p-12 sofia-fade-in">
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-amber-700/10 blur-3xl sofia-spark" />
            <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-emerald-800/10 blur-3xl" />
            <div className="absolute top-1/3 right-1/4 w-1 h-1 rounded-full bg-amber-300 sofia-spark" />
            <div className="absolute top-2/3 right-1/3 w-1 h-1 rounded-full bg-amber-200 sofia-spark" style={{ animationDelay: '0.7s' }} />
            <div className="absolute top-1/4 right-1/2 w-1 h-1 rounded-full bg-amber-100 sofia-spark" style={{ animationDelay: '1.4s' }} />
            <div className="relative max-w-3xl">
              <Badge variant="outline" className="mb-4 border-amber-700/50 text-amber-300 bg-amber-950/40 backdrop-blur-sm">
                <Moon className="w-3 h-3 mr-1.5" /> Telegram-бот · ИИ · Таро · Гороскопы · Двуязычный
              </Badge>
              <h2 className="font-serif text-4xl md:text-6xl font-bold leading-[1.05] mb-4 tracking-tight">
                Приди ко мне, когда <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">на душе тяжело</span>
              </h2>
              <p className="text-base md:text-lg text-stone-300 mb-7 leading-relaxed max-w-2xl">
                Я — София, мудрая ведунья-хранительница. Помню тайгу и руки, что сушили травы, и одновременно —
                слова складываются сами, как река. Карты, гороскопы, душевные разговоры. Я помню о тебе и встречаю теплом.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                <Button asChild size="lg" className="bg-gradient-to-br from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-stone-50 shadow-lg shadow-amber-900/30">
                  <a href="https://t.me/oracultetris_bot" target="_blank" rel="noreferrer">
                    <Sparkles className="w-4 h-4 mr-2" /> Поговорить с Софией
                  </a>
                </Button>
                <a href="#dashboard" className="inline-flex items-center justify-center rounded-md border border-amber-700/40 bg-amber-950/20 backdrop-blur-sm px-6 py-3 text-sm font-medium text-amber-200 hover:bg-amber-950/40 transition-colors">
                  Админ-панель ↓
                </a>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl">
                {[
                  { icon: ScrollText, label: '78 карт', sub: 'полная колода' },
                  { icon: Heart, label: 'Память', sub: 'помнит о тебе' },
                  { icon: Layers, label: '3 слоя', sub: 'личности' },
                  { icon: Globe, label: '2 языка', sub: 'RU · EN' },
                ].map((f, i) => (
                  <div key={i} className="text-center rounded-lg p-2 bg-stone-900/40 border border-stone-800/60">
                    <f.icon className="w-5 h-5 mx-auto text-amber-500 mb-1" />
                    <div className="text-sm font-semibold">{f.label}</div>
                    <div className="text-xs text-stone-500">{f.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Dashboard */}
          <section id="dashboard" className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-serif text-2xl font-semibold">Админ-панель</h3>
                <p className="text-sm text-stone-400">Управление ботом, аналитика, расклады и рассылки</p>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-stone-900/80 border border-stone-800 backdrop-blur-sm p-1 h-auto flex flex-wrap gap-1">
                <TabsTrigger value="overview" className="data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-200">
                  <Activity className="w-3.5 h-3.5 mr-1.5" /> Обзор
                </TabsTrigger>
                <TabsTrigger value="users" className="data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-200">
                  <Users className="w-3.5 h-3.5 mr-1.5" /> Пользователи
                </TabsTrigger>
                <TabsTrigger value="readings" className="data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-200">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Расклады
                </TabsTrigger>
                <TabsTrigger value="streaks" className="data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-200">
                  <Flame className="w-3.5 h-3.5 mr-1.5" /> Серии
                </TabsTrigger>
                <TabsTrigger value="digest" className="data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-200">
                  <Mail className="w-3.5 h-3.5 mr-1.5" /> Дайджест
                </TabsTrigger>
                <TabsTrigger value="broadcasts" className="data-[state=active]:bg-amber-900/40 data-[state=active]:text-amber-200">
                  <Send className="w-3.5 h-3.5 mr-1.5" /> Рассылки
                </TabsTrigger>
              </TabsList>

              {/* Overview */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={Users} label="Пользователей" value={stats?.users.total} loading={loading.stats}
                    accent="text-amber-400" sub={`${stats?.users.onboarded ?? 0} завершили онбординг`}
                    spark={newUsersSpark} sparkColor="#f59e0b" />
                  <StatCard icon={Activity} label="Активны 24ч" value={stats?.users.active24h} loading={loading.stats}
                    accent="text-emerald-400" sub={`${stats?.funnel.retention7d ?? 0}% удержание 7д`}
                    spark={msgSpark.slice(-7)} sparkColor="#10b981" />
                  <StatCard icon={MessageCircle} label="Сообщений" value={stats?.activity.totalMessages} loading={loading.stats}
                    accent="text-sky-300" sub="всего" spark={msgSpark} sparkColor="#7dd3fc" />
                  <StatCard icon={Gem} label="💎 Потрачено" value={stats?.economy.crystalsSpent} loading={loading.stats}
                    accent="text-amber-300" sub={`в обороте: ${stats?.economy.crystalsInCirculation ?? 0}`}
                    spark={crystalsSpark} sparkColor="#fbbf24" />
                </div>

                <div className="grid lg:grid-cols-3 gap-4">
                  {/* Funnel */}
                  <Card className="bg-stone-900/60 border-stone-800 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-stone-100 font-serif flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-amber-400" /> Воронка
                      </CardTitle>
                      <CardDescription className="text-stone-400">Конверсия и удержание</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <FunnelBar label="Всего пользователей" value={stats?.users.total ?? 0} max={stats?.users.total ?? 1} color="bg-stone-600" />
                      <FunnelBar label="Завершили онбординг" value={stats?.users.onboarded ?? 0} max={stats?.users.total ?? 1} color="bg-amber-600" />
                      <FunnelBar label="Активны 7 дней" value={stats?.users.active7d ?? 0} max={stats?.users.total ?? 1} color="bg-emerald-600" />
                      <FunnelBar label="Активны 24 часа" value={stats?.users.active24h ?? 0} max={stats?.users.total ?? 1} color="bg-emerald-500" />
                      <div className="pt-3 border-t border-stone-800 flex justify-between text-sm">
                        <span className="text-stone-400">Конверсия онбординга</span>
                        <span className="font-semibold text-amber-300 font-mono">{stats?.funnel.conversion ?? 0}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Zodiac wheel */}
                  <Card className="bg-stone-900/60 border-stone-800 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-stone-100 font-serif flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-400" /> Знаки зодиака
                      </CardTitle>
                      <CardDescription className="text-stone-400">Распределение по знакам</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center items-center py-2">
                      <ZodiacWheel counts={zodiacCounts} size={220} />
                    </CardContent>
                  </Card>

                  {/* Readings by type */}
                  <Card className="bg-stone-900/60 border-stone-800 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-stone-100 font-serif flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" /> Расклады по типам
                      </CardTitle>
                      <CardDescription className="text-stone-400">Что спрашивают чаще</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-64 overflow-y-auto sofia-scroll pr-1">
                      {loading.stats && <Skeleton className="h-8 w-full" />}
                      {stats?.readingsByType.length === 0 && !loading.stats && (
                        <p className="text-sm text-stone-500 text-center py-4">Пока нет раскладов</p>
                      )}
                      {stats?.readingsByType.map((r) => {
                        const max = stats.readingsByType[0]?.count ?? 1;
                        const color = READING_COLORS[r.type] ?? '#f59e0b';
                        return (
                          <div key={r.type} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-stone-300 truncate">{READING_LABELS[r.type] ?? r.type}</span>
                              <span className="font-mono text-stone-300">{r.count}</span>
                            </div>
                            <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(r.count / max) * 100}%`, background: color }} />
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={Sparkles} label="Раскладов всего" value={stats?.activity.totalReadings} loading={loading.stats} accent="text-amber-400" sub="" spark={readingsSpark} sparkColor="#f59e0b" />
                  <StatCard icon={Send} label="Рассылок" value={stats?.activity.broadcasts} loading={loading.stats} accent="text-stone-300" sub="" />
                  <StatCard icon={TrendingUp} label="Активны 7д" value={stats?.users.active7d} loading={loading.stats} accent="text-emerald-400" sub="" />
                  <StatCard icon={CircleAlert} label="Заблокировано" value={stats?.users.blocked} loading={loading.stats} accent="text-rose-400" sub="" />
                </div>

                {/* Activity 14-day chart */}
                <Card className="bg-stone-900/60 border-stone-800 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-stone-100 font-serif flex items-center gap-2">
                      <Activity className="w-4 h-4 text-amber-400" /> Активность за 14 дней
                    </CardTitle>
                    <CardDescription className="text-stone-400">Сообщения и расклады по дням</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading.activity ? (
                      <Skeleton className="h-48 w-full" />
                    ) : activity.length === 0 ? (
                      <p className="text-center text-stone-500 py-8">Нет данных за выбранный период</p>
                    ) : (
                      <div className="space-y-3">
                        <ActivityChart buckets={activity} />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Referral mini-board */}
                {referrals && referrals.leaderboard.length > 0 && (
                  <Card className="bg-stone-900/60 border-stone-800 backdrop-blur-sm">
                    <CardHeader>
                      <CardTitle className="text-stone-100 font-serif flex items-center gap-2">
                        <Gift className="w-4 h-4 text-amber-400" /> Топ рефералов
                      </CardTitle>
                      <CardDescription className="text-stone-400">
                        Всего: {referrals.totals.totalReferrals} · 💎 начислено: {referrals.totals.crystalsAwarded}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {referrals.leaderboard.slice(0, 6).map((row) => (
                          <div key={row.rank} className="flex items-center gap-3 p-2 rounded-lg bg-stone-950/50 border border-stone-800">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${row.rank === 1 ? 'bg-amber-600/30 text-amber-300' : row.rank === 2 ? 'bg-stone-500/30 text-stone-200' : row.rank === 3 ? 'bg-amber-900/30 text-amber-400' : 'bg-stone-800/50 text-stone-400'}`}>
                              {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {row.referrer?.name ?? row.referrer?.firstName ?? '—'}
                              </div>
                              <div className="text-xs text-stone-500">
                                {row.referrals} {row.referrals === 1 ? 'приглашён' : 'приглашённых'}
                              </div>
                            </div>
                            <Gift className="w-4 h-4 text-amber-500" />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Users */}
              <TabsContent value="users" className="space-y-4">
                <Card className="bg-stone-900/60 border-stone-800 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <CardTitle className="text-stone-100 font-serif">Пользователи</CardTitle>
                        <CardDescription className="text-stone-400">Всего: {usersTotal}</CardDescription>
                      </div>
                      <Input placeholder="Поиск по имени/username…" value={search} onChange={(e) => onSearch(e.target.value)}
                        className="w-64 bg-stone-950 border-stone-700" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border border-stone-800 max-h-[28rem] overflow-y-auto sofia-scroll">
                      <Table>
                        <TableHeader className="sticky top-0 bg-stone-900">
                          <TableRow className="border-stone-800 hover:bg-stone-900">
                            <TableHead className="text-stone-400">Имя</TableHead>
                            <TableHead className="text-stone-400">Username</TableHead>
                            <TableHead className="text-stone-400">Знак</TableHead>
                            <TableHead className="text-stone-400 text-center">🌐</TableHead>
                            <TableHead className="text-stone-400 text-right">💎</TableHead>
                            <TableHead className="text-stone-400 text-right">Сообщ.</TableHead>
                            <TableHead className="text-stone-400 text-right">🔥</TableHead>
                            <TableHead className="text-stone-400">Статус</TableHead>
                            <TableHead className="text-stone-400">Был в сети</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading.users && Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}><TableCell colSpan={9}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                          ))}
                          {!loading.users && users.map((u) => (
                            <TableRow key={u.id} className="border-stone-800 hover:bg-stone-900/60 transition-colors">
                              <TableCell className="font-medium text-stone-100">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-stone-700 to-stone-900 flex items-center justify-center text-xs">
                                    {(u.name ?? u.firstName ?? '?').slice(0, 1).toUpperCase()}
                                  </div>
                                  {u.name ?? u.firstName ?? '—'}
                                </div>
                              </TableCell>
                              <TableCell className="text-stone-400">{u.username ? `@${u.username}` : '—'}</TableCell>
                              <TableCell>{u.zodiacSign ? `${ZODIAC_EMOJI[u.zodiacSign] ?? ''} ${u.zodiacSign}` : '—'}</TableCell>
                              <TableCell className="text-center">
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="outline" className="text-xs border-stone-700 text-stone-400">
                                      {u.language === 'en' ? '🇬🇧' : '🇷🇺'}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>{u.language === 'en' ? 'English' : 'Русский'}</TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="text-right font-mono text-amber-300">{u.crystals}</TableCell>
                              <TableCell className="text-right font-mono">{u.messageCount}</TableCell>
                              <TableCell className="text-right font-mono">
                                {u.streakDays > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 text-orange-400">
                                    <Flame className="w-3 h-3" /> {u.streakDays}
                                  </span>
                                ) : '0'}
                              </TableCell>
                              <TableCell>
                                {u.isBlocked ? <Badge variant="destructive" className="text-xs">блок</Badge>
                                  : u.onboardingCompleted ? <Badge className="text-xs bg-emerald-900/60">активен</Badge>
                                  : <Badge variant="outline" className="text-xs border-stone-600 text-stone-400">{u.onboardingStep}</Badge>}
                                {u.isAdmin && <Badge className="text-xs ml-1 bg-amber-900/60">админ</Badge>}
                              </TableCell>
                              <TableCell className="text-stone-400 text-xs">{timeAgo(u.lastSeenAt)}</TableCell>
                            </TableRow>
                          ))}
                          {!loading.users && users.length === 0 && (
                            <TableRow><TableCell colSpan={9} className="text-center text-stone-500 py-8">Пользователей пока нет</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {usersTotalPages > 1 && (
                      <div className="flex items-center justify-between mt-3">
                        <Button variant="outline" size="sm" disabled={usersPage <= 1} onClick={() => fetchUsers(usersPage - 1, search)} className="border-stone-700 text-stone-300">← Назад</Button>
                        <span className="text-sm text-stone-400">{usersPage} / {usersTotalPages}</span>
                        <Button variant="outline" size="sm" disabled={usersPage >= usersTotalPages} onClick={() => fetchUsers(usersPage + 1, search)} className="border-stone-700 text-stone-300">Вперёд →</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Readings */}
              <TabsContent value="readings" className="space-y-4">
                <Card className="bg-stone-900/60 border-stone-800 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-stone-100 font-serif">Последние расклады</CardTitle>
                    <CardDescription className="text-stone-400">{readings.length} недавних</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-[36rem] overflow-y-auto sofia-scroll pr-1">
                      {loading.readings && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                      {!loading.readings && readings.length === 0 && (
                        <p className="text-center text-stone-500 py-8">Раскладов пока нет. Откройте бота и сделайте первый расклад!</p>
                      )}
                      {readings.map((r) => {
                        const color = READING_COLORS[r.type] ?? '#f59e0b';
                        return (
                          <div key={r.id} className="rounded-lg border border-stone-800 bg-stone-950/50 p-3 hover:border-stone-700 transition-colors">
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-1 h-5 rounded-full" style={{ background: color }} />
                                <Badge variant="outline" className="border-stone-700 text-stone-300 text-xs">
                                  {READING_LABELS[r.type] ?? r.type}
                                </Badge>
                                {r.cost > 0 && <Badge className="bg-amber-950/60 text-amber-300 text-xs">{r.cost} 💎</Badge>}
                              </div>
                              <span className="text-xs text-stone-500 whitespace-nowrap">{timeAgo(r.createdAt)}</span>
                            </div>
                            <div className="text-xs text-stone-400 mb-1.5 flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {r.user.name ?? r.user.firstName ?? '—'}
                              {r.user.zodiacSign ? ` · ${ZODIAC_EMOJI[r.user.zodiacSign] ?? ''} ${r.user.zodiacSign}` : ''}
                            </div>
                            <p className="text-sm text-stone-300 line-clamp-3 leading-relaxed">{r.interpretation}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Streaks */}
              <TabsContent value="streaks" className="space-y-4">
                {!streaks ? (
                  <Card className="bg-stone-900/60 border-stone-800">
                    <CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard icon={Flame} label="Карта дня (7д)" value={streaks.cardOfDayActiveUsers} accent="text-orange-400" sub="активных" />
                      <StatCard icon={Crown} label="Макс. серия" value={streaks.topStreaks[0]?.streakDays ?? 0} accent="text-amber-400" sub="дней подряд" />
                      <StatCard icon={Users} label="С серией >0" value={streaks.distribution.filter((d) => d.bucket !== '0').reduce((a, b) => a + b.count, 0)} accent="text-emerald-400" sub="пользователей" />
                      <StatCard icon={Calendar} label="DAU сегодня" value={streaks.dailyActive[streaks.dailyActive.length - 1]?.count ?? 0} accent="text-sky-300" sub="по lastActivityDay" />
                    </div>

                    <div className="grid lg:grid-cols-2 gap-4">
                      <Card className="bg-stone-900/60 border-stone-800">
                        <CardHeader>
                          <CardTitle className="text-stone-100 font-serif flex items-center gap-2">
                            <Crown className="w-4 h-4 text-amber-400" /> Топ серий
                          </CardTitle>
                          <CardDescription className="text-stone-400">Самые преданные пользователи</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 max-h-72 overflow-y-auto sofia-scroll pr-1">
                          {streaks.topStreaks.length === 0 && (
                            <p className="text-center text-stone-500 py-8">Пока никто не набрал серию</p>
                          )}
                          {streaks.topStreaks.map((u, i) => (
                            <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-stone-950/50 border border-stone-800">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-amber-600/30 text-amber-300' : i === 1 ? 'bg-stone-500/30 text-stone-200' : i === 2 ? 'bg-amber-900/30 text-amber-400' : 'bg-stone-800/50 text-stone-400'}`}>
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{u.name}</div>
                                <div className="text-xs text-stone-500">
                                  {u.username ? `@${u.username} · ` : ''}{u.zodiacSign ? `${ZODIAC_EMOJI[u.zodiacSign] ?? ''} ${u.zodiacSign}` : ''}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-mono text-orange-400 text-lg flex items-center gap-1">
                                  <Flame className="w-4 h-4" />{u.streakDays}
                                </div>
                                <div className="text-xs text-stone-500">{timeAgo(u.lastSeenAt)}</div>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      <Card className="bg-stone-900/60 border-stone-800">
                        <CardHeader>
                          <CardTitle className="text-stone-100 font-serif flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-400" /> Распределение серий
                          </CardTitle>
                          <CardDescription className="text-stone-400">Сколько пользователей в каждой категории</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {streaks.distribution.map((d) => {
                            const max = Math.max(...streaks.distribution.map((x) => x.count), 1);
                            const pct = (d.count / max) * 100;
                            const barColor = d.bucket === '0' ? 'bg-stone-600' : d.bucket === '1-3' ? 'bg-amber-700' : d.bucket === '4-7' ? 'bg-amber-600' : d.bucket === '8-14' ? 'bg-orange-600' : d.bucket === '15-30' ? 'bg-orange-500' : 'bg-red-500';
                            return (
                              <div key={d.bucket} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-stone-400">{d.bucket === '0' ? 'Без серии' : `${d.bucket} дн.`}</span>
                                  <span className="font-mono text-stone-300">{d.count}</span>
                                </div>
                                <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
                                  <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="bg-stone-900/60 border-stone-800">
                      <CardHeader>
                        <CardTitle className="text-stone-100 font-serif flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-sky-400" /> DAU за 14 дней
                        </CardTitle>
                        <CardDescription className="text-stone-400">Daily Active Users по lastActivityDay</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-end gap-1 h-32">
                          {streaks.dailyActive.map((d) => {
                            const max = Math.max(...streaks.dailyActive.map((x) => x.count), 1);
                            const h = (d.count / max) * 100;
                            return (
                              <Tooltip key={d.date}>
                                <TooltipTrigger asChild>
                                  <div className="flex-1 group cursor-pointer">
                                    <div
                                      className="w-full rounded-t bg-gradient-to-t from-amber-900/40 to-amber-500/70 group-hover:from-amber-800/60 group-hover:to-amber-400/90 transition-all"
                                      style={{ height: `${Math.max(2, h)}%` }}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs">
                                    <div className="font-mono">{shortDate(d.date)}</div>
                                    <div className="text-amber-300">{d.count} активных</div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-stone-500">
                          <span>{shortDate(streaks.dailyActive[0]?.date ?? new Date().toISOString())}</span>
                          <span>{shortDate(streaks.dailyActive[streaks.dailyActive.length - 1]?.date ?? new Date().toISOString())}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* Digest */}
              <TabsContent value="digest" className="space-y-4">
                {!digest ? (
                  <Card className="bg-stone-900/60 border-stone-800">
                    <CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent>
                  </Card>
                ) : (
                  <>
                    <Card className="bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/30 border-amber-900/40 backdrop-blur-sm">
                      <CardHeader>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div>
                            <CardTitle className="text-stone-100 font-serif flex items-center gap-2 text-xl">
                              <Mail className="w-5 h-5 text-amber-400" /> Недельный дайджест
                            </CardTitle>
                            <CardDescription className="text-stone-400">
                              {new Date(digest.weekRange.from).toLocaleDateString('ru-RU')} — {new Date(digest.weekRange.to).toLocaleDateString('ru-RU')}
                            </CardDescription>
                          </div>
                          {digest.lastSentAt ? (
                            <Badge variant="outline" className="border-emerald-700/50 text-emerald-300 bg-emerald-950/30">
                              <Clock className="w-3 h-3 mr-1" /> Отправлен: {timeAgo(digest.lastSentAt)}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-700/50 text-amber-300 bg-amber-950/30">
                              <Clock className="w-3 h-3 mr-1" /> Ещё не отправлялся на этой неделе
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-stone-300 leading-relaxed mb-4 italic font-serif">
                          🌙 Каждый воскресенье София автоматически собирает недельную сводку и отправляет её всем админам.
                          Ниже — превью того, что попадёт в следующий дайджест.
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <DigestStat icon={Users} label="Новых" value={digest.stats.newUsers} color="text-amber-400" />
                          <DigestStat icon={Activity} label="Активны 7д" value={digest.stats.active7d} color="text-emerald-400" />
                          <DigestStat icon={MessageCircle} label="Сообщений" value={digest.stats.messages} color="text-sky-300" />
                          <DigestStat icon={Sparkles} label="Раскладов" value={digest.stats.readings} color="text-amber-300" />
                          <DigestStat icon={Gem} label="💎 Потрачено" value={digest.stats.crystalsSpent} color="text-amber-500" />
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid lg:grid-cols-2 gap-4">
                      <Card className="bg-stone-900/60 border-stone-800">
                        <CardHeader>
                          <CardTitle className="text-stone-100 font-serif flex items-center gap-2">
                            <Crown className="w-4 h-4 text-amber-400" /> Топ-5 за неделю
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {digest.topUsers.length === 0 && <p className="text-center text-stone-500 py-6">Нет активных пользователей</p>}
                          {digest.topUsers.map((u, i) => (
                            <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-stone-950/50 border border-stone-800">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-700/40 to-stone-800 flex items-center justify-center text-xs font-bold text-amber-300">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{u.name}</div>
                                <div className="text-xs text-stone-500">
                                  {u.username ? `@${u.username} · ` : ''}{u.zodiacSign ? `${ZODIAC_EMOJI[u.zodiacSign] ?? ''} ${u.zodiacSign}` : ''}
                                </div>
                              </div>
                              <div className="text-right text-xs">
                                <div className="font-mono text-stone-200">{u.messageCount} сообщ.</div>
                                {u.streakDays > 0 && <div className="text-orange-400">🔥 {u.streakDays}</div>}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      <Card className="bg-stone-900/60 border-stone-800">
                        <CardHeader>
                          <CardTitle className="text-stone-100 font-serif flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" /> Расклады за неделю
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {digest.readingsByType.length === 0 && <p className="text-center text-stone-500 py-6">Не было раскладов</p>}
                          {digest.readingsByType.map((r) => {
                            const max = digest.readingsByType[0]?.count ?? 1;
                            const color = READING_COLORS[r.type] ?? '#f59e0b';
                            return (
                              <div key={r.type} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-stone-300">{READING_LABELS[r.type] ?? r.type}</span>
                                  <span className="font-mono text-stone-300">{r.count}</span>
                                </div>
                                <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${(r.count / max) * 100}%`, background: color }} />
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    </div>

                    {digest.recentBroadcasts.length > 0 && (
                      <Card className="bg-stone-900/60 border-stone-800">
                        <CardHeader>
                          <CardTitle className="text-stone-100 font-serif flex items-center gap-2">
                            <Send className="w-4 h-4 text-amber-400" /> Рассылки на этой неделе
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {digest.recentBroadcasts.map((b) => (
                            <div key={b.id} className="rounded-lg border border-stone-800 bg-stone-950/50 p-3">
                              <div className="flex items-center justify-between mb-1">
                                <Badge variant={b.status === 'done' ? 'default' : 'outline'} className="text-xs">
                                  {b.status === 'done' ? '✓ отправлено' : b.status}
                                </Badge>
                                <span className="text-xs text-stone-500">{timeAgo(b.createdAt)}</span>
                              </div>
                              <p className="text-sm text-stone-300 line-clamp-2 mb-1">{b.text}</p>
                              <p className="text-xs text-stone-500">Отправлено: {b.sentCount} / {b.total} · ошибок: {b.failedCount}</p>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>

              {/* Broadcasts */}
              <TabsContent value="broadcasts" className="space-y-4">
                <Card className="bg-stone-900/60 border-stone-800 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-stone-100 font-serif">Новая рассылка</CardTitle>
                    <CardDescription className="text-stone-400">Отправить сообщение всем пользователям</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea placeholder="Текст рассылки…" value={broadcastText} onChange={(e) => setBroadcastText(e.target.value)}
                      rows={4} className="bg-stone-950 border-stone-700 resize-none" />
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-stone-500">
                        💡 Поддерживается HTML-форматирование. Рассылка отправится асинхронно — бот берёт её из БД каждые 8 секунд.
                      </p>
                      <Button onClick={sendBroadcast} disabled={sending} className="bg-gradient-to-br from-amber-600 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-stone-50 shadow-md shadow-amber-900/30">
                        <Send className={`w-4 h-4 mr-2 ${sending ? 'animate-pulse' : ''}`} /> {sending ? 'Отправка…' : 'Отправить'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-stone-900/60 border-stone-800">
                  <CardHeader>
                    <CardTitle className="text-stone-100 font-serif">История рассылок</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-64 overflow-y-auto sofia-scroll pr-1">
                      {loading.broadcasts && <Skeleton className="h-16 w-full" />}
                      {!loading.broadcasts && broadcasts.length === 0 && (
                        <p className="text-center text-stone-500 py-4">Рассылок пока не было</p>
                      )}
                      {broadcasts.map((b) => (
                        <div key={b.id} className="rounded-lg border border-stone-800 bg-stone-950/50 p-3 hover:border-stone-700 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant={b.status === 'done' ? 'default' : 'outline'} className="text-xs">
                              {b.status === 'done' ? '✓ отправлено' : b.status}
                            </Badge>
                            <span className="text-xs text-stone-500">{timeAgo(b.createdAt)}</span>
                          </div>
                          <p className="text-sm text-stone-300 line-clamp-2 mb-1">{b.text}</p>
                          <div className="flex items-center gap-3 text-xs text-stone-500">
                            <span>Отправлено: {b.sentCount} / {b.total}</span>
                            {b.failedCount > 0 && <span className="text-rose-400">ошибок: {b.failedCount}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </section>

          {/* Architecture summary */}
          <section className="grid md:grid-cols-3 gap-4">
            <Card className="bg-stone-900/40 border-stone-800 backdrop-blur-sm">
              <CardHeader><CardTitle className="text-stone-100 font-serif text-lg flex items-center gap-2"><Bot className="w-4 h-4 text-amber-500" /> Архитектура</CardTitle></CardHeader>
              <CardContent className="text-sm text-stone-400 space-y-1.5">
                <p className="flex items-start gap-2"><span className="text-amber-500">•</span> Clean Architecture (4 слоя)</p>
                <p className="flex items-start gap-2"><span className="text-amber-500">•</span> grammY + TypeScript + Prisma</p>
                <p className="flex items-start gap-2"><span className="text-amber-500">•</span> z-ai-web-dev-sdk для ИИ</p>
                <p className="flex items-start gap-2"><span className="text-amber-500">•</span> FSM с сохранением в БД</p>
                <p className="flex items-start gap-2"><span className="text-amber-500">•</span> Mini-service на порту 3003</p>
              </CardContent>
            </Card>
            <Card className="bg-stone-900/40 border-stone-800 backdrop-blur-sm">
              <CardHeader><CardTitle className="text-stone-100 font-serif text-lg flex items-center gap-2"><Heart className="w-4 h-4 text-rose-400" /> Личность</CardTitle></CardHeader>
              <CardContent className="text-sm text-stone-400 space-y-1.5">
                <p className="flex items-start gap-2"><span className="text-rose-400">•</span> Хранительница — тепло, безопасность</p>
                <p className="flex items-start gap-2"><span className="text-rose-400">•</span> Наблюдатель — мягкая психология</p>
                <p className="flex items-start gap-2"><span className="text-rose-400">•</span> Проводник — карты как зеркало</p>
                <p className="flex items-start gap-2"><span className="text-rose-400">•</span> Нравственный кодекс</p>
                <p className="flex items-start gap-2"><span className="text-rose-400">•</span> Эмоциональная память</p>
              </CardContent>
            </Card>
            <Card className="bg-stone-900/40 border-stone-800 backdrop-blur-sm">
              <CardHeader><CardTitle className="text-stone-100 font-serif text-lg flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> Возможности</CardTitle></CardHeader>
              <CardContent className="text-sm text-stone-400 space-y-1.5">
                <p className="flex items-start gap-2"><span className="text-amber-400">•</span> 6 типов раскладов Таро</p>
                <p className="flex items-start gap-2"><span className="text-amber-400">•</span> Карта дня + аффирмации</p>
                <p className="flex items-start gap-2"><span className="text-amber-400">•</span> Реферальная программа</p>
                <p className="flex items-start gap-2"><span className="text-amber-400">•</span> История раскладов</p>
                <p className="flex items-start gap-2"><span className="text-amber-400">•</span> 🌐 Двуязычность (RU/EN)</p>
                <p className="flex items-start gap-2"><span className="text-amber-400">•</span> 📨 Недельный дайджест</p>
                <p className="flex items-start gap-2"><span className="text-amber-400">•</span> 🔥 Серии и удержание</p>
              </CardContent>
            </Card>
          </section>
        </main>

        <footer className="mt-auto border-t border-amber-900/30 bg-stone-950">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-stone-500">
            <p>🔮 София — мудрая ведунья. Telegram-бот на Clean Architecture.</p>
            <p className="mt-1 text-xs">Документация: <code className="text-stone-400">docs/</code> · Worklog: <code className="text-stone-400">worklog.md</code></p>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}

function StatCard({ icon: Icon, label, value, loading, accent, sub, spark, sparkColor }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value?: number; loading?: boolean;
  accent: string; sub?: string; spark?: number[]; sparkColor?: string;
}) {
  return (
    <Card className="bg-stone-900/60 border-stone-800 backdrop-blur-sm hover:border-stone-700 transition-colors group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs text-stone-400">{label}</span>
          <Icon className={`w-4 h-4 ${accent} group-hover:scale-110 transition-transform`} />
        </div>
        <div className={`text-2xl font-bold font-mono ${accent} flex items-baseline gap-2`}>
          {loading ? <Skeleton className="h-7 w-16" /> : (value ?? 0).toLocaleString('ru-RU')}
          {spark && spark.length > 0 && !loading && (
            <Sparkline data={spark} width={70} height={20} color={sparkColor ?? '#f59e0b'} />
          )}
        </div>
        {sub && <div className="text-xs text-stone-500 mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-stone-400">{label}</span>
        <span className="font-mono text-stone-300">{value.toLocaleString('ru-RU')}</span>
      </div>
      <div className="h-2 bg-stone-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DigestStat({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string;
}) {
  return (
    <div className="rounded-lg bg-stone-950/40 border border-stone-800 p-3 text-center">
      <Icon className={`w-4 h-4 mx-auto ${color} mb-1`} />
      <div className={`text-xl font-bold font-mono ${color}`}>{value.toLocaleString('ru-RU')}</div>
      <div className="text-xs text-stone-500">{label}</div>
    </div>
  );
}

function ActivityChart({ buckets }: { buckets: ActivityBucket[] }) {
  const maxMsgs = Math.max(...buckets.map((b) => b.messages), 1);
  const maxReadings = Math.max(...buckets.map((b) => b.readings), 1);
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-stone-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Сообщения
          </span>
          <span className="text-stone-500">max: {maxMsgs}</span>
        </div>
        <div className="flex items-end gap-1 h-32">
          {buckets.map((b) => {
            const h = (b.messages / maxMsgs) * 100;
            return (
              <Tooltip key={b.date}>
                <TooltipTrigger asChild>
                  <div className="flex-1 group cursor-pointer">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-amber-900/40 to-amber-500/80 group-hover:from-amber-800/60 group-hover:to-amber-400/100 transition-all"
                      style={{ height: `${Math.max(2, h)}%` }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs">
                    <div className="font-mono">{shortDate(b.date)}</div>
                    <div className="text-amber-300">{b.messages} сообщ.</div>
                    <div className="text-stone-400">раскладов: {b.readings}</div>
                    <div className="text-emerald-400">новых: {b.newUsers}</div>
                    <div className="text-amber-500">💎 {b.crystalsSpent}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-stone-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-500" /> Расклады
          </span>
          <span className="text-stone-500">max: {maxReadings}</span>
        </div>
        <div className="flex items-end gap-1 h-16">
          {buckets.map((b) => {
            const h = (b.readings / maxReadings) * 100;
            return (
              <div key={b.date} className="flex-1">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-purple-900/40 to-purple-500/80 transition-all"
                  style={{ height: `${Math.max(2, h)}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between text-xs text-stone-500">
        <span>{shortDate(buckets[0]?.date ?? new Date().toISOString())}</span>
        <span>{shortDate(buckets[buckets.length - 1]?.date ?? new Date().toISOString())}</span>
      </div>
    </div>
  );
}
