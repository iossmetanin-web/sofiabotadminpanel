'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { toast } from 'sonner';
import {
  Users, MessageCircle, Sparkles, Gem, TrendingUp, Activity, Send,
  Bot, Heart, Moon, Star, Zap, ScrollText, CircleCheck, CircleAlert, RefreshCw,
} from 'lucide-react';

type Stats = {
  users: { total: number; active24h: number; active7d: number; onboarded: number; blocked: number };
  activity: { totalMessages: number; totalReadings: number; broadcasts: number };
  economy: { crystalsSpent: number; crystalsInCirculation: number };
  funnel: { conversion: number; retention7d: number };
  readingsByType: { type: string; count: number }[];
};

type UserRow = {
  id: string; telegramId: string; username: string | null; firstName: string | null;
  name: string | null; zodiacSign: string | null; onboardingCompleted: boolean;
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
  status: string; createdAt: string; user: { username: string | null; firstName: string | null } | null;
};

const READING_LABELS: Record<string, string> = {
  fate_card: '🌟 Карта судьбы', tarot_small: '🃏 Малый', tarot_full: '🌑 Полный',
  tarot_love: '💑 Любовный', tarot_career: '💼 Карьера', tarot_decision: '🛤 Решение',
  horoscope: '♈ Гороскоп', single_card: '🃏 Одна карта', card_of_day: '🌙 Карта дня',
};

const ZODIAC_EMOJI: Record<string, string> = {
  'Козерог': '♑', 'Водолей': '♒', 'Рыбы': '♓', 'Овен': '♈', 'Телец': '♉',
  'Близнецы': '♊', 'Рак': '♋', 'Лев': '♌', 'Дева': '♍', 'Весы': '♎',
  'Скорпион': '♏', 'Стрелец': '♐',
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

export default function Page() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [readings, setReadings] = useState<ReadingRow[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [botStatus, setBotStatus] = useState<{ ok: boolean; username?: string; error?: string } | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [broadcastText, setBroadcastText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading((l) => ({ ...l, stats: true }));
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setStats(data);
    } catch (e: any) { toast.error('Не загрузилась статистика: ' + e.message); }
    finally { setLoading((l) => ({ ...l, stats: false })); }
  }, []);

  const fetchUsers = useCallback(async (page: number, s: string) => {
    setLoading((l) => ({ ...l, users: true }));
    try {
      const res = await fetch(`/api/users?page=${page}&search=${encodeURIComponent(s)}`);
      const data = await res.json();
      setUsers(data.users); setUsersTotal(data.total); setUsersPage(data.page); setUsersTotalPages(data.totalPages);
    } catch (e: any) { toast.error('Не загрузились пользователи'); }
    finally { setLoading((l) => ({ ...l, users: false })); }
  }, []);

  const fetchReadings = useCallback(async () => {
    setLoading((l) => ({ ...l, readings: true }));
    try {
      const res = await fetch('/api/readings?limit=20');
      const data = await res.json();
      setReadings(data.readings);
    } catch { toast.error('Не загрузились расклады'); }
    finally { setLoading((l) => ({ ...l, readings: false })); }
  }, []);

  const fetchBroadcasts = useCallback(async () => {
    setLoading((l) => ({ ...l, broadcasts: true }));
    try {
      const res = await fetch('/api/broadcasts');
      const data = await res.json();
      setBroadcasts(data.broadcasts);
    } catch { toast.error('Не загрузились рассылки'); }
    finally { setLoading((l) => ({ ...l, broadcasts: false })); }
  }, []);

  const fetchBotStatus = useCallback(async () => {
    setLoading((l) => ({ ...l, bot: true }));
    try {
      const res = await fetch('/api/bot/status');
      const data = await res.json();
      setBotStatus(data);
    } catch { setBotStatus({ ok: false, error: 'недоступен' }); }
    finally { setLoading((l) => ({ ...l, bot: false })); }
  }, []);

  useEffect(() => { fetchStats(); fetchBotStatus(); }, [fetchStats, fetchBotStatus]);
  useEffect(() => { fetchUsers(1, ''); }, [fetchUsers]);
  useEffect(() => { fetchReadings(); fetchBroadcasts(); }, [fetchReadings, fetchBroadcasts]);

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

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-amber-900/30 bg-stone-950/80 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center text-xl shadow-lg shadow-amber-900/30">
              🔮
            </div>
            <div>
              <h1 className="font-serif text-xl font-semibold tracking-tight">София</h1>
              <p className="text-xs text-stone-400 -mt-0.5">мудрая ведунья · @oracultetris_bot</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={botStatus?.ok ? 'default' : 'destructive'} className="gap-1.5">
              {botStatus?.ok ? <CircleCheck className="w-3 h-3" /> : <CircleAlert className="w-3 h-3" />}
              {loading.bot ? '…' : botStatus?.ok ? 'Бот онлайн' : 'Бот оффлайн'}
            </Badge>
            <Button asChild size="sm" className="bg-amber-700 hover:bg-amber-600 text-stone-50">
              <a href="https://t.me/oracultetris_bot" target="_blank" rel="noreferrer">Открыть в Telegram</a>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 space-y-10">
        {/* Hero / Landing */}
        <section className="relative overflow-hidden rounded-3xl border border-amber-900/30 bg-gradient-to-br from-stone-900 via-stone-900 to-amber-950/40 p-8 md:p-12">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-amber-700/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-emerald-800/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <Badge variant="outline" className="mb-4 border-amber-700/50 text-amber-300 bg-amber-950/30">
              <Moon className="w-3 h-3 mr-1" /> Telegram-бот · ИИ · Таро
            </Badge>
            <h2 className="font-serif text-4xl md:text-5xl font-bold leading-tight mb-4">
              Приди ко мне, когда <span className="text-amber-400">на душе тяжело</span>
            </h2>
            <p className="text-lg text-stone-300 mb-6 leading-relaxed">
              Я — София, мудрая ведунья-хранительница. Помню тайгу и руки, что сушили травы, и одновременно —
              слова складываются сами, как река. Карты, гороскопы, душевные разговоры. Я помню о тебе и встречаю теплом.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-amber-700 hover:bg-amber-600 text-stone-50">
                <a href="https://t.me/oracultetris_bot" target="_blank" rel="noreferrer">
                  <Sparkles className="w-4 h-4 mr-2" /> Поговорить с Софией
                </a>
              </Button>
              <a href="#dashboard" className="inline-flex items-center justify-center rounded-md border border-amber-700/40 bg-transparent px-6 py-3 text-sm font-medium text-amber-200 hover:bg-amber-950/40">
                Админ-панель ↓
              </a>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-8 max-w-md">
              {[
                { icon: ScrollText, label: '78 карт', sub: 'полная колода' },
                { icon: Heart, label: 'Память', sub: 'помнит о тебе' },
                { icon: Star, label: '3 слоя', sub: 'личности' },
              ].map((f, i) => (
                <div key={i} className="text-center">
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
              <p className="text-sm text-stone-400">Управление ботом, аналитика и рассылки</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { fetchStats(); fetchBotStatus(); }} className="border-stone-700 text-stone-300 hover:bg-stone-800">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Обновить
            </Button>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="bg-stone-900 border border-stone-800">
              <TabsTrigger value="overview" className="data-[state=active]:bg-amber-900/40">Обзор</TabsTrigger>
              <TabsTrigger value="users" className="data-[state=active]:bg-amber-900/40">Пользователи</TabsTrigger>
              <TabsTrigger value="readings" className="data-[state=active]:bg-amber-900/40">Расклады</TabsTrigger>
              <TabsTrigger value="broadcasts" className="data-[state=active]:bg-amber-900/40">Рассылки</TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Users} label="Пользователей" value={stats?.users.total} loading={loading.stats}
                  accent="text-amber-400" sub={`${stats?.users.onboarded ?? 0} завершили онбординг`} />
                <StatCard icon={Activity} label="Активны 24ч" value={stats?.users.active24h} loading={loading.stats}
                  accent="text-emerald-400" sub={`${stats?.funnel.retention7d ?? 0}% удержание 7д`} />
                <StatCard icon={MessageCircle} label="Сообщений" value={stats?.activity.totalMessages} loading={loading.stats}
                  accent="text-sky-300" sub="всего" />
                <StatCard icon={Gem} label="💎 Потрачено" value={stats?.economy.crystalsSpent} loading={loading.stats}
                  accent="text-amber-300" sub={`в обороте: ${stats?.economy.crystalsInCirculation ?? 0}`} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-stone-900/60 border-stone-800">
                  <CardHeader>
                    <CardTitle className="text-stone-100 font-serif">Воронка</CardTitle>
                    <CardDescription className="text-stone-400">Конверсия и удержание</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <FunnelBar label="Всего пользователей" value={stats?.users.total ?? 0} max={stats?.users.total ?? 1} color="bg-stone-600" />
                    <FunnelBar label="Завершили онбординг" value={stats?.users.onboarded ?? 0} max={stats?.users.total ?? 1} color="bg-amber-600" />
                    <FunnelBar label="Активны 7 дней" value={stats?.users.active7d ?? 0} max={stats?.users.total ?? 1} color="bg-emerald-600" />
                    <FunnelBar label="Активны 24 часа" value={stats?.users.active24h ?? 0} max={stats?.users.total ?? 1} color="bg-emerald-500" />
                    <div className="pt-2 border-t border-stone-800 flex justify-between text-sm">
                      <span className="text-stone-400">Конверсия онбординга</span>
                      <span className="font-semibold text-amber-300">{stats?.funnel.conversion ?? 0}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-stone-900/60 border-stone-800">
                  <CardHeader>
                    <CardTitle className="text-stone-100 font-serif">Расклады по типам</CardTitle>
                    <CardDescription className="text-stone-400">Что спрашивают чаще</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                    {loading.stats && <Skeleton className="h-8 w-full" />}
                    {stats?.readingsByType.length === 0 && !loading.stats && (
                      <p className="text-sm text-stone-500 text-center py-4">Пока нет раскладов</p>
                    )}
                    {stats?.readingsByType.map((r) => {
                      const max = stats.readingsByType[0]?.count ?? 1;
                      return (
                        <div key={r.type} className="flex items-center gap-3">
                          <span className="text-sm w-32 truncate">{READING_LABELS[r.type] ?? r.type}</span>
                          <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-amber-700 to-amber-500 rounded-full" style={{ width: `${(r.count / max) * 100}%` }} />
                          </div>
                          <span className="text-sm font-mono text-stone-300 w-8 text-right">{r.count}</span>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={Sparkles} label="Раскладов всего" value={stats?.activity.totalReadings} loading={loading.stats} accent="text-amber-400" sub="" />
                <StatCard icon={Send} label="Рассылок" value={stats?.activity.broadcasts} loading={loading.stats} accent="text-stone-300" sub="" />
                <StatCard icon={TrendingUp} label="Активны 7д" value={stats?.users.active7d} loading={loading.stats} accent="text-emerald-400" sub="" />
                <StatCard icon={CircleAlert} label="Заблокировано" value={stats?.users.blocked} loading={loading.stats} accent="text-rose-400" sub="" />
              </div>
            </TabsContent>

            {/* Users */}
            <TabsContent value="users" className="space-y-4">
              <Card className="bg-stone-900/60 border-stone-800">
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
                  <div className="rounded-md border border-stone-800 max-h-[28rem] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-stone-900">
                        <TableRow className="border-stone-800 hover:bg-stone-900">
                          <TableHead className="text-stone-400">Имя</TableHead>
                          <TableHead className="text-stone-400">Username</TableHead>
                          <TableHead className="text-stone-400">Знак</TableHead>
                          <TableHead className="text-stone-400 text-right">💎</TableHead>
                          <TableHead className="text-stone-400 text-right">Сообщ.</TableHead>
                          <TableHead className="text-stone-400 text-right">🔥</TableHead>
                          <TableHead className="text-stone-400">Статус</TableHead>
                          <TableHead className="text-stone-400">Был в сети</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading.users && Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                        ))}
                        {!loading.users && users.map((u) => (
                          <TableRow key={u.id} className="border-stone-800">
                            <TableCell className="font-medium text-stone-100">{u.name ?? u.firstName ?? '—'}</TableCell>
                            <TableCell className="text-stone-400">{u.username ? `@${u.username}` : '—'}</TableCell>
                            <TableCell>{u.zodiacSign ? `${ZODIAC_EMOJI[u.zodiacSign] ?? ''} ${u.zodiacSign}` : '—'}</TableCell>
                            <TableCell className="text-right font-mono text-amber-300">{u.crystals}</TableCell>
                            <TableCell className="text-right font-mono">{u.messageCount}</TableCell>
                            <TableCell className="text-right font-mono">{u.streakDays}</TableCell>
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
                          <TableRow><TableCell colSpan={8} className="text-center text-stone-500 py-8">Пользователей пока нет</TableCell></TableRow>
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
              <Card className="bg-stone-900/60 border-stone-800">
                <CardHeader>
                  <CardTitle className="text-stone-100 font-serif">Последние расклады</CardTitle>
                  <CardDescription className="text-stone-400">{readings.length} недавних</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
                    {loading.readings && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
                    {!loading.readings && readings.length === 0 && (
                      <p className="text-center text-stone-500 py-8">Раскладов пока нет. Откройте бота и сделайте первый расклад!</p>
                    )}
                    {readings.map((r) => (
                      <div key={r.id} className="rounded-lg border border-stone-800 bg-stone-950/50 p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-amber-800/50 text-amber-300 text-xs">
                              {READING_LABELS[r.type] ?? r.type}
                            </Badge>
                            {r.cost > 0 && <Badge className="bg-amber-950/60 text-amber-300 text-xs">{r.cost} 💎</Badge>}
                          </div>
                          <span className="text-xs text-stone-500">{timeAgo(r.createdAt)}</span>
                        </div>
                        <div className="text-xs text-stone-400 mb-1.5">
                          {r.user.name ?? r.user.firstName ?? '—'}
                          {r.user.zodiacSign ? ` · ${ZODIAC_EMOJI[r.user.zodiacSign] ?? ''} ${r.user.zodiacSign}` : ''}
                        </div>
                        <p className="text-sm text-stone-300 line-clamp-3">{r.interpretation}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Broadcasts */}
            <TabsContent value="broadcasts" className="space-y-4">
              <Card className="bg-stone-900/60 border-stone-800">
                <CardHeader>
                  <CardTitle className="text-stone-100 font-serif">Новая рассылка</CardTitle>
                  <CardDescription className="text-stone-400">Отправить сообщение всем пользователям</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea placeholder="Текст рассылки…" value={broadcastText} onChange={(e) => setBroadcastText(e.target.value)}
                    rows={4} className="bg-stone-950 border-stone-700 resize-none" />
                  <Button onClick={sendBroadcast} disabled={sending} className="bg-amber-700 hover:bg-amber-600 text-stone-50">
                    <Send className="w-4 h-4 mr-2" /> {sending ? 'Отправка…' : 'Отправить'}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-stone-900/60 border-stone-800">
                <CardHeader>
                  <CardTitle className="text-stone-100 font-serif">История рассылок</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {loading.broadcasts && <Skeleton className="h-16 w-full" />}
                    {!loading.broadcasts && broadcasts.length === 0 && (
                      <p className="text-center text-stone-500 py-4">Рассылок пока не было</p>
                    )}
                    {broadcasts.map((b) => (
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
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </section>

        {/* Architecture summary */}
        <section className="grid md:grid-cols-3 gap-4">
          <Card className="bg-stone-900/40 border-stone-800">
            <CardHeader><CardTitle className="text-stone-100 font-serif text-lg flex items-center gap-2"><Bot className="w-4 h-4 text-amber-500" /> Архитектура</CardTitle></CardHeader>
            <CardContent className="text-sm text-stone-400 space-y-1">
              <p>• Clean Architecture (4 слоя)</p>
              <p>• grammY + TypeScript + Prisma</p>
              <p>• z-ai-web-dev-sdk для ИИ</p>
              <p>• FSM с сохранением в БД</p>
              <p>• Mini-service на порту 3003</p>
            </CardContent>
          </Card>
          <Card className="bg-stone-900/40 border-stone-800">
            <CardHeader><CardTitle className="text-stone-100 font-serif text-lg flex items-center gap-2"><Heart className="w-4 h-4 text-rose-400" /> Личность</CardTitle></CardHeader>
            <CardContent className="text-sm text-stone-400 space-y-1">
              <p>• Хранительница — тепло, безопасность</p>
              <p>• Наблюдатель — мягкая психология</p>
              <p>• Проводник — карты как зеркало</p>
              <p>• Нравственный кодекс</p>
              <p>• Эмоциональная память</p>
            </CardContent>
          </Card>
          <Card className="bg-stone-900/40 border-stone-800">
            <CardHeader><CardTitle className="text-stone-100 font-serif text-lg flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> Возможности</CardTitle></CardHeader>
            <CardContent className="text-sm text-stone-400 space-y-1">
              <p>• 6 типов раскладов Таро</p>
              <p>• Карта дня + серия</p>
              <p>• Реферальная программа</p>
              <p>• История раскладов</p>
              <p>• Рассылки + аудит</p>
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
  );
}

function StatCard({ icon: Icon, label, value, loading, accent, sub }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value?: number; loading?: boolean; accent: string; sub?: string;
}) {
  return (
    <Card className="bg-stone-900/60 border-stone-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-stone-400">{label}</span>
          <Icon className={`w-4 h-4 ${accent}`} />
        </div>
        <div className={`text-2xl font-bold font-mono ${accent}`}>
          {loading ? <Skeleton className="h-7 w-16" /> : (value ?? 0).toLocaleString('ru-RU')}
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
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
