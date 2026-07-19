'use client';

/* ──────────────────────────────────────────────────────────────────
   Sofia Bot Admin - control panel
   Design language: dark charcoal (zinc-950) + antique amber accent,
   Geist + Geist Mono, hairline tables, mono tabular numerals,
   asymmetric bento overview, motivated motion only.
   ────────────────────────────────────────────────────────────────── */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Badge,
} from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Users, MessageCircle, Sparkles, Gem, TrendingUp, Activity, Send,
  Bot, Heart, Moon, Star, Zap, ScrollText, CircleCheck, CircleAlert, RefreshCw,
  Flame, Crown, Calendar, Mail, Gift, ArrowUpRight, Clock,
  Eye, Settings, Download, ChevronDown, ChevronUp, Wallet,
  Plus, Minus, ExternalLink, FileDown, RotateCcw, Save, Check,
  HandCoins, UserPlus, BadgePercent, Search, ArrowRight, ArrowLeft,
} from 'lucide-react';
import { Sparkline } from '@/components/sofia/Sparkline';
import { ZodiacWheel } from '@/components/sofia/ZodiacWheel';
import { ZODIAC_EMOJI } from '@/components/sofia/zodiac-data';
import {
  SectionHeader, BentoTile, MetricTile, EmptyState, ErrorState,
  StaggerGroup, StaggerItem, TabTransition, Hairline, MiniBar,
  AnimatedNumber,
} from '@/components/sofia/AdminKit';

/* ─── Types ─────────────────────────────────────────────────────────── */

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

type EconomyData = {
  transactions: {
    id: string; userId: string; type: string; amount: number;
    description: string | null; balanceAfter: number | null;
    createdAt: string; user: { name: string | null; firstName: string | null; username: string | null; telegramId: string };
  }[];
  total: number; page: number; totalPages: number;
  summary: {
    totalSpent: number; totalSpentCount: number;
    totalAdded: number; totalAddedCount: number;
    totalDailyBonus: number; totalDailyBonusCount: number;
    totalReferral: number; totalReferralCount: number;
    totalAdminGift: number; totalAdminGiftCount: number;
    totalInCirculation: number; avgBalance: number; zeroBalanceUsers: number;
  };
  typeBreakdown: { type: string; count: number; total: number }[];
};

type SettingsData = {
  settings: { id: string; key: string; value: string; updatedAt: string }[];
};

type TabKey = 'overview' | 'users' | 'readings' | 'streaks' | 'economy' | 'digest' | 'broadcasts' | 'settings';

/* ─── Constants ─────────────────────────────────────────────────────── */

const READING_LABELS: Record<string, string> = {
  fate_card: 'Карта судьбы', tarot_small: 'Малый расклад', tarot_full: 'Полный расклад',
  tarot_love: 'Любовный', tarot_career: 'Карьера', tarot_decision: 'Решение',
  horoscope: 'Гороскоп', single_card: 'Одна карта', card_of_day: 'Карта дня',
  yes_no: 'Да / Нет',
};

// Amber-only stripe palette. Vary opacity to distinguish reading types.
const READING_BAR_COLOR: Record<string, string> = {
  fate_card: 'bg-amber-400',
  tarot_small: 'bg-amber-500',
  tarot_full: 'bg-amber-300',
  tarot_love: 'bg-amber-600',
  tarot_career: 'bg-amber-500/80',
  tarot_decision: 'bg-amber-400/80',
  horoscope: 'bg-amber-300/80',
  single_card: 'bg-zinc-500',
  card_of_day: 'bg-amber-400/60',
  yes_no: 'bg-amber-500/60',
};

const READING_STRIPE: Record<string, string> = {
  fate_card: 'bg-amber-400',
  tarot_small: 'bg-amber-500',
  tarot_full: 'bg-amber-300',
  tarot_love: 'bg-amber-600',
  tarot_career: 'bg-amber-500/80',
  tarot_decision: 'bg-amber-400/80',
  horoscope: 'bg-amber-300/80',
  single_card: 'bg-zinc-500',
  card_of_day: 'bg-amber-400/60',
  yes_no: 'bg-amber-500/60',
};

const TX_TYPE_LABELS: Record<string, string> = {
  spend: 'Трата', add: 'Начисление', daily_bonus: 'Ежедневный бонус',
  referral: 'Реферал', admin_gift: 'Подарок', subscription: 'Подписка',
};

const TX_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Все' },
  { value: 'spend', label: 'Трата' },
  { value: 'add', label: 'Начисление' },
  { value: 'daily_bonus', label: 'Бонус' },
  { value: 'referral', label: 'Реферал' },
  { value: 'admin_gift', label: 'Подарок' },
];

const TABS: { value: TabKey; label: string }[] = [
  { value: 'overview', label: 'Обзор' },
  { value: 'users', label: 'Пользователи' },
  { value: 'readings', label: 'Расклады' },
  { value: 'streaks', label: 'Серии' },
  { value: 'economy', label: 'Экономика' },
  { value: 'digest', label: 'Дайджест' },
  { value: 'broadcasts', label: 'Рассылки' },
  { value: 'settings', label: 'Настройки' },
];

/* ─── Utility ───────────────────────────────────────────────────────── */

function timeAgo(iso: string | null): string {
  if (!iso) return 'никогда';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} дн`;
  return new Date(iso).toLocaleDateString('ru-RU');
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function fmtNum(n: number): string {
  return n.toLocaleString('ru-RU');
}

/* ─── Main Page ─────────────────────────────────────────────────────── */

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
  const [economy, setEconomy] = useState<EconomyData | null>(null);
  const [settingsData, setSettingsData] = useState<SettingsData | null>(null);
  const [botStatus, setBotStatus] = useState<{
    ok: boolean; username?: string; lastHeartbeat?: string; ageSeconds?: number; error?: string;
  } | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [broadcastText, setBroadcastText] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Economy-specific state
  const [ecoPage, setEcoPage] = useState(1);
  const [ecoType, setEcoType] = useState('');
  const [expandedReading, setExpandedReading] = useState<string | null>(null);

  // Settings-specific state
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState<Record<string, boolean>>({});
  const [savedSettings, setSavedSettings] = useState<Record<string, boolean>>({});

  // Quick action dialogs
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState('10');
  const [quickActionLoading, setQuickActionLoading] = useState(false);

  /* ─── Data fetchers ─────────────────────────────────────────────── */

  const fetchStats = useCallback(async () => {
    setLoading((l) => ({ ...l, stats: true }));
    try { const res = await fetch('/api/stats'); const data = await res.json(); setStats(data); }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown';
      toast.error('Не загрузилась статистика: ' + msg);
    } finally { setLoading((l) => ({ ...l, stats: false })); }
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

  const fetchEconomy = useCallback(async (page: number, type: string) => {
    setLoading((l) => ({ ...l, economy: true }));
    try {
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (type) params.set('type', type);
      const res = await fetch(`/api/economy?${params}`);
      const data = await res.json();
      setEconomy(data);
    } catch { /* silent */ }
    finally { setLoading((l) => ({ ...l, economy: false })); }
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading((l) => ({ ...l, settings: true }));
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setSettingsData(data);
      const vals: Record<string, string> = {};
      for (const s of data.settings) vals[s.key] = s.value;
      setEditValues(vals);
    } catch { /* silent */ }
    finally { setLoading((l) => ({ ...l, settings: false })); }
  }, []);

  const fetchBotStatus = useCallback(async () => {
    setLoading((l) => ({ ...l, bot: true }));
    try { const res = await fetch('/api/bot/status'); const data = await res.json(); setBotStatus(data); }
    catch { setBotStatus({ ok: false, error: 'недоступен' }); }
    finally { setLoading((l) => ({ ...l, bot: false })); }
  }, []);

  /* ─── Effects ───────────────────────────────────────────────────── */

  useEffect(() => { fetchStats(); fetchBotStatus(); fetchActivity(); }, [fetchStats, fetchBotStatus, fetchActivity]);
  useEffect(() => { fetchUsers(1, ''); }, [fetchUsers]);
  useEffect(() => { fetchReadings(); fetchBroadcasts(); }, [fetchReadings, fetchBroadcasts]);

  useEffect(() => {
    if (activeTab === 'streaks' && !streaks) fetchStreaks();
    if (activeTab === 'digest' && !digest) fetchDigest();
    if (activeTab === 'overview' && !referrals) fetchReferrals();
    if (activeTab === 'economy' && !economy) fetchEconomy(1, '');
    if (activeTab === 'settings' && !settingsData) fetchSettings();
  }, [activeTab, streaks, digest, referrals, economy, settingsData, fetchStreaks, fetchDigest, fetchReferrals, fetchEconomy, fetchSettings]);

  useEffect(() => {
    const t = setInterval(() => { fetchBotStatus(); }, 30_000);
    return () => clearInterval(t);
  }, [fetchBotStatus]);

  /* ─── Handlers ──────────────────────────────────────────────────── */

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
      if (res.ok) {
        toast.success(`Рассылка запущена (id: ${data.id}, получателей: ${data.total})`);
        setBroadcastText('');
        fetchBroadcasts();
      } else { toast.error(data.error ?? 'Ошибка'); }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'unknown';
      toast.error('Не удалось отправить: ' + msg);
    } finally { setSending(false); }
  };

  const saveSetting = async (key: string) => {
    const value = editValues[key];
    if (value === undefined) return;
    setSavingSettings((s) => ({ ...s, [key]: true }));
    setSavedSettings((s) => ({ ...s, [key]: false }));
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        toast.success(`Настройка "${key}" сохранена`);
        setSavedSettings((s) => ({ ...s, [key]: true }));
        setTimeout(() => setSavedSettings((s) => ({ ...s, [key]: false })), 2000);
      } else { toast.error('Не удалось сохранить'); }
    } catch { toast.error('Ошибка сохранения'); }
    finally { setSavingSettings((s) => ({ ...s, [key]: false })); }
  };

  const handleGiftAll = async () => {
    setQuickActionLoading(true);
    try {
      const amt = parseInt(giftAmount, 10);
      if (isNaN(amt) || amt <= 0) { toast.error('Некорректное количество'); return; }
      const res = await fetch('/api/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'pending_gift_all', value: String(amt) }),
      });
      if (res.ok) {
        toast.success(`Начисление ${amt} кристаллов всем запланировано`);
        setGiftDialogOpen(false);
      }
    } catch { toast.error('Ошибка'); }
    finally { setQuickActionLoading(false); }
  };

  const handleResetStreaks = async () => {
    setQuickActionLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'pending_reset_streaks', value: 'true' }),
      });
      if (res.ok) {
        toast.success('Сброс серий запланирован');
        setResetDialogOpen(false);
      }
    } catch { toast.error('Ошибка'); }
    finally { setQuickActionLoading(false); }
  };

  const handleExport = (type: string) => {
    window.open(`/api/export?type=${type}`, '_blank');
  };

  const refreshCurrentTab = () => {
    if (activeTab === 'overview') { fetchStats(); fetchBotStatus(); fetchActivity(); fetchReferrals(); }
    if (activeTab === 'users') fetchUsers(usersPage, search);
    if (activeTab === 'readings') fetchReadings();
    if (activeTab === 'streaks') fetchStreaks();
    if (activeTab === 'economy') fetchEconomy(ecoPage, ecoType);
    if (activeTab === 'digest') fetchDigest();
    if (activeTab === 'broadcasts') fetchBroadcasts();
    if (activeTab === 'settings') fetchSettings();
  };

  /* ─── Derived ───────────────────────────────────────────────────── */

  const zodiacCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const u of users) if (u.zodiacSign) m[u.zodiacSign] = (m[u.zodiacSign] ?? 0) + 1;
    return m;
  }, [users]);

  const msgSpark = activity.map((b) => b.messages);
  const readingsSpark = activity.map((b) => b.readings);
  const newUsersSpark = activity.map((b) => b.newUsers);
  const crystalsSpark = activity.map((b) => b.crystalsSpent);

  const isRefreshing =
    loading.stats || loading.users || loading.readings || loading.activity ||
    loading.streaks || loading.referrals || loading.digest || loading.economy ||
    loading.settings || loading.broadcasts;

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
        {/* ─── Sticky top nav ──────────────────────────────────── */}
        <header className="sticky top-0 z-50 h-16 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8 h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/5 shadow-sm shadow-amber-500/10">
                <Moon className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
              </div>
              <div className="leading-tight min-w-0">
                <h1 className="text-sm font-semibold tracking-tight text-zinc-100">Sofia Bot Admin</h1>
                <p className="text-[11px] text-zinc-500 font-mono truncate">
                  @{botStatus?.username ?? 'oracultetris_bot'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Bot status pill (semantic) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="hidden sm:flex items-center gap-2 h-8 px-3 rounded-md border border-zinc-800/70 bg-zinc-900/50 text-xs hover:border-zinc-700/80 active:translate-y-px transition-colors"
                    type="button"
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        botStatus?.ok ? 'bg-amber-400 sofia-pulse-dot' : 'bg-rose-400'
                      }`}
                    />
                    <span className="text-zinc-300 font-mono tabular-nums">
                      {loading.bot ? '...' : botStatus?.ok ? `${botStatus.ageSeconds ?? 0}s` : 'offline'}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {botStatus?.lastHeartbeat
                    ? `Heartbeat: ${new Date(botStatus.lastHeartbeat).toLocaleString('ru-RU')}`
                    : 'Нет данных'}
                </TooltipContent>
              </Tooltip>

              {/* Refresh */}
              <Button
                variant="outline"
                size="sm"
                onClick={refreshCurrentTab}
                className="h-8 border-zinc-800/70 bg-zinc-900/50 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 active:translate-y-px"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                <span className="hidden sm:inline ml-1.5">Обновить</span>
              </Button>

              {/* Export dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-zinc-800/70 bg-zinc-900/50 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800/60 active:translate-y-px"
                  >
                    <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="hidden sm:inline ml-1.5">Экспорт</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-zinc-900 border-zinc-800" align="end">
                  <DropdownMenuItem onClick={() => handleExport('users')} className="text-zinc-200 focus:bg-zinc-800 focus:text-amber-300">
                    <FileDown className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} /> Пользователи CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('readings')} className="text-zinc-200 focus:bg-zinc-800 focus:text-amber-300">
                    <FileDown className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} /> Расклады CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('transactions')} className="text-zinc-200 focus:bg-zinc-800 focus:text-amber-300">
                    <FileDown className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} /> Транзакции CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Open bot */}
              <Button asChild size="sm" className="h-8 bg-amber-500 text-zinc-950 hover:bg-amber-400 active:translate-y-px shadow-sm shadow-amber-500/20">
                <a href="https://t.me/oracultetris_bot" target="_blank" rel="noreferrer">
                  <Send className="w-3.5 h-3.5" strokeWidth={1.5} />
                  <span className="hidden sm:inline ml-1.5">Открыть</span>
                </a>
              </Button>
            </div>
          </div>
        </header>

        {/* ─── Tab bar ─────────────────────────────────────────── */}
        <div className="sticky top-16 z-40 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8">
            <nav
              role="tablist"
              aria-label="Разделы админ-панели"
              className="flex items-center gap-1 overflow-x-auto sofia-scroll -mb-px"
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.value)}
                    className={`relative shrink-0 h-11 px-3.5 text-sm font-medium transition-colors active:translate-y-px ${
                      isActive
                        ? 'text-amber-400'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {tab.label}
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute left-0 right-0 -bottom-px h-0.5 bg-amber-400 rounded-full"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* ─── Main content ────────────────────────────────────── */}
        <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-8 py-8 space-y-8">
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <TabTransition className="space-y-6">
              <SectionHeader
                title="Обзор"
                description="Сводка по боту за последние 14 дней: активность, расклады, экономика, удержание."
              />

              {/* Asymmetric bento grid - hero (4) + status (2) */}
              <StaggerGroup className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <StaggerItem className="md:col-span-4">
                  <BentoTile className="h-full">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 mb-1.5">
                          Активные за 24 часа
                        </p>
                        <div className="text-5xl font-mono tabular-nums font-semibold text-zinc-100 leading-none">
                          {loading.stats ? (
                            <Skeleton className="h-12 w-32" />
                          ) : (
                            <AnimatedNumber value={stats?.users.active24h ?? 0} />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
                        <span className="font-mono tabular-nums">
                          {stats?.funnel.retention7d ?? 0}% удержание 7д
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-zinc-800/70">
                      <HeroStat label="Всего" value={stats?.users.total} loading={loading.stats} />
                      <HeroStat label="Онбординг" value={stats?.users.onboarded} loading={loading.stats} />
                      <HeroStat label="7 дней" value={stats?.users.active7d} loading={loading.stats} />
                    </div>
                  </BentoTile>
                </StaggerItem>

                <StaggerItem className="md:col-span-2">
                  <BentoTile className="h-full flex flex-col">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 mb-3">
                      Бот
                    </p>
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={`flex h-2.5 w-2.5 rounded-full ${
                          botStatus?.ok ? 'bg-amber-400 sofia-pulse-dot' : 'bg-rose-400'
                        }`}
                      />
                      <span className="text-lg font-semibold text-zinc-100">
                        {loading.bot ? '...' : botStatus?.ok ? 'Онлайн' : 'Оффлайн'}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs font-mono tabular-nums text-zinc-400">
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Аптайм</span>
                        <span>{botStatus?.ageSeconds ?? 0}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Хартбит</span>
                        <span className="truncate ml-2 max-w-[10ch]">
                          {botStatus?.lastHeartbeat ? timeAgo(botStatus.lastHeartbeat) : 'нет'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Заблок.</span>
                        <span>{stats?.users.blocked ?? 0}</span>
                      </div>
                    </div>
                    <div className="mt-auto pt-4">
                      <a
                        href="https://t.me/oracultetris_bot"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 active:translate-y-px transition"
                      >
                        Открыть в Telegram
                        <ArrowUpRight className="w-3 h-3" strokeWidth={1.5} />
                      </a>
                    </div>
                  </BentoTile>
                </StaggerItem>
              </StaggerGroup>

              {/* Metric row - asymmetric: 4 + 2 */}
              <StaggerGroup className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <StaggerItem className="md:col-span-4">
                  <MetricTile
                    label="Сообщений всего"
                    value={stats?.activity.totalMessages}
                    loading={loading.stats}
                    icon={MessageCircle}
                    spark={msgSpark}
                    sparkColor="#fbbf24"
                    sub={
                      <span className="font-mono tabular-nums">
                        раскладов: {fmtNum(stats?.activity.totalReadings ?? 0)} · рассылок: {fmtNum(stats?.activity.broadcasts ?? 0)}
                      </span>
                    }
                  />
                </StaggerItem>
                <StaggerItem className="md:col-span-2">
                  <MetricTile
                    label="Кристаллов потрачено"
                    value={stats?.economy.crystalsSpent}
                    loading={loading.stats}
                    icon={Gem}
                    spark={crystalsSpark}
                    sparkColor="#f59e0b"
                    sub={<span className="font-mono tabular-nums">в обороте: {fmtNum(stats?.economy.crystalsInCirculation ?? 0)}</span>}
                  />
                </StaggerItem>
              </StaggerGroup>

              {/* Activity chart (4) + readings by type (2) */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <BentoTile className="md:col-span-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">Активность за 14 дней</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">Сообщения и расклады по дням</p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Сообщения
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500/40" /> Расклады
                      </span>
                    </div>
                  </div>
                  {loading.activity ? (
                    <Skeleton className="h-40 w-full" />
                  ) : activity.length === 0 ? (
                    <EmptyState
                      icon={Activity}
                      title="Нет данных за период"
                      description="Данные появятся, когда пользователи начнут активность"
                    />
                  ) : (
                    <ActivityChart buckets={activity} />
                  )}
                </BentoTile>

                <BentoTile className="md:col-span-2">
                  <h3 className="text-sm font-semibold text-zinc-100 mb-1">Расклады по типам</h3>
                  <p className="text-xs text-zinc-500 mb-4">Что спрашивают чаще</p>
                  <div className="space-y-2.5 max-h-56 overflow-y-auto sofia-scroll pr-1">
                    {loading.stats && Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-full" />
                    ))}
                    {stats?.readingsByType.length === 0 && !loading.stats && (
                      <EmptyState
                        icon={Sparkles}
                        title="Пока нет раскладов"
                        description="Поделитесь ботом, чтобы пользователи начали расклады"
                      />
                    )}
                    {stats?.readingsByType.map((r) => {
                      const max = stats.readingsByType[0]?.count ?? 1;
                      return (
                        <MiniBar
                          key={r.type}
                          label={READING_LABELS[r.type] ?? r.type}
                          value={r.count}
                          max={max}
                          display={fmtNum(r.count)}
                          color={READING_BAR_COLOR[r.type] ?? 'bg-amber-500/70'}
                        />
                      );
                    })}
                  </div>
                </BentoTile>
              </div>

              {/* Funnel (2) + Zodiac (4) - asymmetric */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <BentoTile className="md:col-span-2">
                  <h3 className="text-sm font-semibold text-zinc-100 mb-1">Воронка</h3>
                  <p className="text-xs text-zinc-500 mb-4">Конверсия и удержание</p>
                  <div className="space-y-3">
                    <FunnelBar label="Всего" value={stats?.users.total ?? 0} max={stats?.users.total ?? 1} color="bg-zinc-600" />
                    <FunnelBar label="Онбординг" value={stats?.users.onboarded ?? 0} max={stats?.users.total ?? 1} color="bg-amber-600" />
                    <FunnelBar label="7 дней" value={stats?.users.active7d ?? 0} max={stats?.users.total ?? 1} color="bg-amber-500" />
                    <FunnelBar label="24 часа" value={stats?.users.active24h ?? 0} max={stats?.users.total ?? 1} color="bg-amber-400" />
                    <div className="pt-3 mt-1 border-t border-zinc-800/70 flex justify-between text-xs">
                      <span className="text-zinc-400">Конверсия</span>
                      <span className="font-mono tabular-nums text-amber-400">
                        {stats?.funnel.conversion ?? 0}%
                      </span>
                    </div>
                  </div>
                </BentoTile>

                <BentoTile className="md:col-span-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">Знаки зодиака</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">Распределение подписчиков по знакам</p>
                    </div>
                    <Star className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center">
                    <div className="flex justify-center items-center py-1">
                      <ZodiacWheel counts={zodiacCounts} size={200} />
                    </div>
                    <ZodiacBreakdown counts={zodiacCounts} />
                  </div>
                </BentoTile>
              </div>

              {/* Top referrals - full width */}
              <BentoTile>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">Топ рефералов</h3>
                    <p className="text-xs text-zinc-500 mt-0.5 font-mono tabular-nums">
                      всего: {referrals?.totals.totalReferrals ?? 0} · вознаграждено: {referrals?.totals.rewardedReferrals ?? 0} · кристаллов начислено: {referrals?.totals.crystalsAwarded ?? 0}
                    </p>
                  </div>
                  <Gift className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {loading.referrals && Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                  {!loading.referrals && referrals?.leaderboard.length === 0 && (
                    <div className="col-span-full">
                      <EmptyState
                        icon={Gift}
                        title="Рефералов пока нет"
                        description="Появятся, когда пользователи начнут приглашать друзей"
                      />
                    </div>
                  )}
                  {referrals?.leaderboard.slice(0, 6).map((row) => (
                    <div
                      key={row.rank}
                      className="flex items-center gap-3 px-2.5 py-2 rounded-md border border-zinc-800/60 hover:border-zinc-700/80 hover:bg-zinc-900/40 transition-colors"
                    >
                      <span className="text-xs font-mono tabular-nums text-zinc-500 w-6">
                        {String(row.rank).padStart(2, '0')}
                      </span>
                      <span className="flex-1 text-sm text-zinc-200 truncate">
                        {row.referrer?.name ?? row.referrer?.firstName ?? 'Аноним'}
                      </span>
                      <span className="text-xs font-mono tabular-nums text-amber-400">
                        {row.referrals}
                      </span>
                    </div>
                  ))}
                </div>
              </BentoTile>
            </TabTransition>
          )}

          {/* USERS */}
          {activeTab === 'users' && (
            <TabTransition className="space-y-5">
              <SectionHeader
                title="Пользователи"
                description="База подписчиков бота. Поиск, экспорт, профиль в Telegram, быстрое начисление кристаллов."
                right={
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" strokeWidth={1.5} />
                    <Input
                      placeholder="Поиск по имени или username"
                      value={search}
                      onChange={(e) => onSearch(e.target.value)}
                      className="pl-8 w-64 h-8 bg-zinc-900/50 border-zinc-800/70 text-sm placeholder:text-zinc-600"
                    />
                  </div>
                }
              />

              <div className="text-xs uppercase tracking-wider text-zinc-500 font-mono">
                Всего записей: {fmtNum(usersTotal)}
              </div>

              {/* Hairline table - no boxed card around it */}
              <div className="rounded-lg border border-zinc-800/60 overflow-hidden">
                <div className="max-h-[32rem] overflow-y-auto sofia-scroll">
                  <Table>
                    <TableHeader className="sticky top-0 bg-zinc-950/95 backdrop-blur-sm z-10">
                      <TableRow className="border-zinc-800/60 hover:bg-transparent">
                        <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Имя</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Username</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Знак</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium text-center">Язык</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium text-right">Кристаллы</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium text-right">Сообщ.</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium text-right">Серия</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Статус</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Был в сети</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading.users && Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i} className="border-zinc-800/60">
                          {Array.from({ length: 10 }).map((__, j) => (
                            <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {!loading.users && users.map((u) => (
                        <TableRow key={u.id} className="border-zinc-800/60 hover:bg-zinc-900/40 transition-colors">
                          <TableCell className="font-medium text-zinc-100">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800/80 text-[10px] font-mono text-zinc-400">
                                {(u.name ?? u.firstName ?? '?').slice(0, 1).toUpperCase()}
                              </div>
                              <span className="truncate">{u.name ?? u.firstName ?? '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-zinc-400 font-mono text-xs">
                            {u.username ? `@${u.username}` : '-'}
                          </TableCell>
                          <TableCell className="text-zinc-300 text-xs">
                            {u.zodiacSign ? `${ZODIAC_EMOJI[u.zodiacSign] ?? ''} ${u.zodiacSign}` : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-xs text-zinc-500 font-mono">{u.language === 'en' ? 'EN' : 'RU'}</span>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-amber-400">{u.crystals}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-zinc-300">{u.messageCount}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {u.streakDays > 0 ? (
                              <span className="inline-flex items-center gap-1 text-amber-400">
                                <Flame className="w-3 h-3" strokeWidth={1.5} />
                                {u.streakDays}
                              </span>
                            ) : <span className="text-zinc-600">0</span>}
                          </TableCell>
                          <TableCell>
                            {u.isBlocked ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                                <span className="h-1 w-1 rounded-full bg-rose-400" /> блок
                              </span>
                            ) : u.onboardingCompleted ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-zinc-300">
                                <span className="h-1 w-1 rounded-full bg-amber-400" /> активен
                              </span>
                            ) : (
                              <span className="text-[11px] text-zinc-500 font-mono">{u.onboardingStep}</span>
                            )}
                            {u.isAdmin && (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">admin</span>
                            )}
                          </TableCell>
                          <TableCell className="text-zinc-500 text-xs font-mono tabular-nums">{timeAgo(u.lastSeenAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-zinc-500 hover:text-amber-400 hover:bg-zinc-800/60 active:translate-y-px"
                                    onClick={() => window.open(`https://t.me/${u.username ?? u.telegramId}`, '_blank')}
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Профиль в Telegram</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-zinc-500 hover:text-amber-400 hover:bg-zinc-800/60 active:translate-y-px"
                                    onClick={() => {
                                      fetch('/api/settings', {
                                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ key: `pending_gift_${u.telegramId}`, value: '5' }),
                                      }).then(() => toast.success(`+5 кристаллов для ${u.name ?? u.firstName ?? u.telegramId}`));
                                    }}
                                  >
                                    <Gem className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Подарить +5 кристаллов</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!loading.users && users.length === 0 && (
                        <TableRow className="border-zinc-800/60">
                          <TableCell colSpan={10}>
                            <EmptyState
                              icon={Users}
                              title="Пользователей пока нет"
                              description="Поделитесь ссылкой на бота, чтобы привлечь первых подписчиков"
                              action="Открыть бота"
                              onAction={() => window.open('https://t.me/oracultetris_bot', '_blank')}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {usersTotalPages > 1 && (
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={usersPage <= 1}
                    onClick={() => fetchUsers(usersPage - 1, search)}
                    className="h-8 border-zinc-800/70 bg-zinc-900/50 text-zinc-300 hover:text-zinc-100 active:translate-y-px disabled:opacity-40"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} /> Назад
                  </Button>
                  <span className="text-xs text-zinc-500 font-mono tabular-nums">
                    {usersPage} / {usersTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={usersPage >= usersTotalPages}
                    onClick={() => fetchUsers(usersPage + 1, search)}
                    className="h-8 border-zinc-800/70 bg-zinc-900/50 text-zinc-300 hover:text-zinc-100 active:translate-y-px disabled:opacity-40"
                  >
                    Вперёд <ArrowRight className="w-3.5 h-3.5 ml-1.5" strokeWidth={1.5} />
                  </Button>
                </div>
              )}
            </TabTransition>
          )}

          {/* READINGS */}
          {activeTab === 'readings' && (
            <TabTransition className="space-y-5">
              <SectionHeader
                title="Расклады"
                description="Последние 20 раскладов Таро. Раскройте карточку, чтобы увидеть полный текст интерпретации."
                right={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('readings')}
                    className="h-8 border-zinc-800/70 bg-zinc-900/50 text-zinc-300 hover:text-amber-400 active:translate-y-px"
                  >
                    <FileDown className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} /> CSV
                  </Button>
                }
              />

              <div className="text-xs uppercase tracking-wider text-zinc-500 font-mono">
                Записей: {fmtNum(readings.length)}
              </div>

              <div className="space-y-2">
                {loading.readings && Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))}
                {!loading.readings && readings.length === 0 && (
                  <BentoTile interactive={false} className="py-12">
                    <EmptyState
                      icon={Sparkles}
                      title="Пока никто не делал расклады"
                      description="Откройте бота и сделайте первый расклад"
                      action="Открыть бота"
                      onAction={() => window.open('https://t.me/oracultetris_bot', '_blank')}
                    />
                  </BentoTile>
                )}
                {readings.map((r) => {
                  const stripeColor = READING_STRIPE[r.type] ?? 'bg-amber-500';
                  const isExpanded = expandedReading === r.id;
                  return (
                    <Collapsible key={r.id} open={isExpanded} onOpenChange={(open) => setExpandedReading(open ? r.id : null)}>
                      <div
                        className={`rounded-lg border bg-zinc-900/40 transition-colors ${
                          isExpanded ? 'border-amber-500/40' : 'border-zinc-800/60 hover:border-zinc-700/80'
                        }`}
                      >
                        <div className="flex items-stretch">
                          <div className={`w-1 shrink-0 ${stripeColor} rounded-l-lg`} />
                          <div className="flex-1 p-3.5 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge variant="outline" className="border-zinc-700/70 text-zinc-300 text-[11px] font-medium">
                                  {READING_LABELS[r.type] ?? r.type}
                                </Badge>
                                {r.cost > 0 && (
                                  <span className="text-[11px] font-mono tabular-nums text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                    {r.cost} 💎
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-zinc-500 font-mono tabular-nums">{timeAgo(r.createdAt)}</span>
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-amber-400 hover:bg-zinc-800/60 active:translate-y-px">
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={1.5} /> : <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />}
                                  </Button>
                                </CollapsibleTrigger>
                              </div>
                            </div>
                            <div className="text-[11px] text-zinc-500 mb-2 flex items-center gap-1.5 font-mono">
                              <Eye className="w-3 h-3" strokeWidth={1.5} />
                              {r.user.name ?? r.user.firstName ?? '-'}
                              {r.user.zodiacSign ? ` · ${ZODIAC_EMOJI[r.user.zodiacSign] ?? ''} ${r.user.zodiacSign}` : ''}
                            </div>
                            <p className={`text-sm text-zinc-300 leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}>
                              {r.interpretation}
                            </p>
                            <CollapsibleContent>
                              <div className="mt-3 pt-3 border-t border-zinc-800/70 space-y-3">
                                {r.question && (
                                  <div>
                                    <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Вопрос</p>
                                    <p className="text-sm text-zinc-400 italic">{r.question}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Полная интерпретация</p>
                                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{r.interpretation}</p>
                                </div>
                              </div>
                            </CollapsibleContent>
                          </div>
                        </div>
                      </div>
                    </Collapsible>
                  );
                })}
              </div>
            </TabTransition>
          )}

          {/* STREAKS */}
          {activeTab === 'streaks' && (
            <TabTransition className="space-y-5">
              <SectionHeader
                title="Серии"
                description="Ежедневная активность пользователей и распределение по длине серии."
              />

              {!streaks ? (
                <BentoTile interactive={false}><Skeleton className="h-64 w-full" /></BentoTile>
              ) : (
                <>
                  <StaggerGroup className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StaggerItem>
                      <MetricTile label="Карта дня (7д)" value={streaks.cardOfDayActiveUsers} icon={Flame} accent="text-amber-400" sub="активных" />
                    </StaggerItem>
                    <StaggerItem>
                      <MetricTile
                        label="Максимальная серия"
                        value={streaks.topStreaks[0]?.streakDays ?? 0}
                        icon={Crown}
                        accent="text-amber-400"
                        sub="дней подряд"
                      />
                    </StaggerItem>
                    <StaggerItem>
                      <MetricTile
                        label="С серией > 0"
                        value={streaks.distribution.filter((d) => d.bucket !== '0').reduce((a, b) => a + b.count, 0)}
                        icon={Users}
                        accent="text-amber-400"
                        sub="пользователей"
                      />
                    </StaggerItem>
                    <StaggerItem>
                      <MetricTile
                        label="DAU сегодня"
                        value={streaks.dailyActive[streaks.dailyActive.length - 1]?.count ?? 0}
                        icon={Calendar}
                        accent="text-amber-400"
                        sub="по lastActivityDay"
                      />
                    </StaggerItem>
                  </StaggerGroup>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <BentoTile>
                      <div className="flex items-center gap-2 mb-4">
                        <Crown className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                        <h3 className="text-sm font-semibold text-zinc-100">Топ серий</h3>
                      </div>
                      <div className="space-y-1.5 max-h-72 overflow-y-auto sofia-scroll pr-1">
                        {streaks.topStreaks.length === 0 && (
                          <EmptyState icon={Flame} title="Серий пока нет" description="Появятся, когда пользователи начнут заходить каждый день" />
                        )}
                        {streaks.topStreaks.map((u, i) => (
                          <div key={u.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-zinc-900/60 transition-colors">
                            <span className={`text-xs font-mono tabular-nums w-6 ${i < 3 ? 'text-amber-400' : 'text-zinc-500'}`}>
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-zinc-200 truncate">{u.name}</div>
                              <div className="text-[11px] text-zinc-500 font-mono truncate">
                                {u.username ? `@${u.username}` : ''}{u.zodiacSign ? ` · ${ZODIAC_EMOJI[u.zodiacSign] ?? ''} ${u.zodiacSign}` : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-mono tabular-nums text-amber-400 flex items-center gap-1 justify-end">
                                <Flame className="w-3.5 h-3.5" strokeWidth={1.5} />
                                {u.streakDays}
                              </div>
                              <div className="text-[11px] text-zinc-500 font-mono">{timeAgo(u.lastSeenAt)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </BentoTile>

                    <BentoTile>
                      <div className="flex items-center gap-2 mb-4">
                        <Flame className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                        <h3 className="text-sm font-semibold text-zinc-100">Распределение серий</h3>
                      </div>
                      <div className="space-y-3">
                        {streaks.distribution.map((d) => {
                          const max = Math.max(...streaks.distribution.map((x) => x.count), 1);
                          return (
                            <MiniBar
                              key={d.bucket}
                              label={d.bucket === '0' ? 'Без серии' : `${d.bucket} дн.`}
                              value={d.count}
                              max={max}
                              display={fmtNum(d.count)}
                              color={
                                d.bucket === '0' ? 'bg-zinc-600' :
                                d.bucket === '1-3' ? 'bg-amber-700' :
                                d.bucket === '4-7' ? 'bg-amber-600' :
                                d.bucket === '8-14' ? 'bg-amber-500' :
                                d.bucket === '15-30' ? 'bg-amber-400' :
                                'bg-amber-300'
                              }
                              muted={d.bucket === '0'}
                            />
                          );
                        })}
                      </div>
                    </BentoTile>
                  </div>

                  <BentoTile>
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                      <h3 className="text-sm font-semibold text-zinc-100">DAU за 14 дней</h3>
                    </div>
                    <div className="flex items-end gap-1 h-32">
                      {streaks.dailyActive.map((d) => {
                        const max = Math.max(...streaks.dailyActive.map((x) => x.count), 1);
                        const h = (d.count / max) * 100;
                        return (
                          <Tooltip key={d.date}>
                            <TooltipTrigger asChild>
                              <div className="flex-1 group cursor-pointer">
                                <div
                                  className="w-full rounded-t bg-amber-500/70 group-hover:bg-amber-400 transition-colors"
                                  style={{ height: `${Math.max(2, h)}%` }}
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-xs font-mono tabular-nums">
                                <div>{shortDate(d.date)}</div>
                                <div className="text-amber-300">{d.count} активных</div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-3 text-[11px] text-zinc-500 font-mono tabular-nums">
                      <span>{shortDate(streaks.dailyActive[0]?.date ?? new Date().toISOString())}</span>
                      <span>{shortDate(streaks.dailyActive[streaks.dailyActive.length - 1]?.date ?? new Date().toISOString())}</span>
                    </div>
                  </BentoTile>
                </>
              )}
            </TabTransition>
          )}

          {/* ECONOMY */}
          {activeTab === 'economy' && (
            <TabTransition className="space-y-5">
              <SectionHeader
                title="Экономика"
                description="Поток кристаллов: начисления, траты, оборот и история транзакций."
              />

              {!economy ? (
                <BentoTile interactive={false}><Skeleton className="h-64 w-full" /></BentoTile>
              ) : (
                <>
                  <StaggerGroup className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StaggerItem>
                      <MetricTile
                        label="Потрачено всего"
                        value={economy.summary.totalSpent}
                        icon={ArrowUpRight}
                        accent="text-amber-400"
                        sub={<span className="font-mono tabular-nums">{fmtNum(economy.summary.totalSpentCount)} транзакций</span>}
                      />
                    </StaggerItem>
                    <StaggerItem>
                      <MetricTile
                        label="В обороте"
                        value={economy.summary.totalInCirculation}
                        icon={Wallet}
                        accent="text-amber-400"
                        sub="у пользователей"
                      />
                    </StaggerItem>
                    <StaggerItem>
                      <MetricTile
                        label="Средний баланс"
                        value={economy.summary.avgBalance}
                        icon={TrendingUp}
                        accent="text-amber-400"
                        sub="на пользователя"
                      />
                    </StaggerItem>
                    <StaggerItem>
                      <MetricTile
                        label="С нулевым балансом"
                        value={economy.summary.zeroBalanceUsers}
                        icon={UserPlus}
                        accent="text-zinc-400"
                        sub="пользователей"
                      />
                    </StaggerItem>
                  </StaggerGroup>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <BentoTile>
                      <div className="flex items-center gap-2 mb-4">
                        <HandCoins className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                        <h3 className="text-sm font-semibold text-zinc-100">Поток кристаллов</h3>
                      </div>
                      <div className="space-y-4">
                        <FlowBar
                          label="Начислено"
                          value={economy.summary.totalAdded}
                          total={economy.summary.totalAdded + economy.summary.totalSpent}
                          color="bg-amber-500"
                        />
                        <FlowBar
                          label="Потрачено"
                          value={economy.summary.totalSpent}
                          total={economy.summary.totalAdded + economy.summary.totalSpent}
                          color="bg-zinc-600"
                        />
                      </div>
                      <Hairline className="my-4" />
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-zinc-500 mb-0.5">Ежедневный бонус</div>
                          <div className="font-mono tabular-nums text-amber-400">
                            {fmtNum(economy.summary.totalDailyBonus)} ({economy.summary.totalDailyBonusCount})
                          </div>
                        </div>
                        <div>
                          <div className="text-zinc-500 mb-0.5">Рефералы</div>
                          <div className="font-mono tabular-nums text-amber-400">
                            {fmtNum(economy.summary.totalReferral)} ({economy.summary.totalReferralCount})
                          </div>
                        </div>
                        <div>
                          <div className="text-zinc-500 mb-0.5">Админ-подарки</div>
                          <div className="font-mono tabular-nums text-amber-400">
                            {fmtNum(economy.summary.totalAdminGift)} ({economy.summary.totalAdminGiftCount})
                          </div>
                        </div>
                        <div>
                          <div className="text-zinc-500 mb-0.5">Начисления всего</div>
                          <div className="font-mono tabular-nums text-amber-400">
                            {fmtNum(economy.summary.totalAdded)} ({economy.summary.totalAddedCount})
                          </div>
                        </div>
                      </div>
                    </BentoTile>

                    <BentoTile>
                      <div className="flex items-center gap-2 mb-4">
                        <BadgePercent className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                        <h3 className="text-sm font-semibold text-zinc-100">Разбивка по типам</h3>
                      </div>
                      <div className="space-y-3">
                        {economy.typeBreakdown.length === 0 && (
                          <EmptyState icon={Wallet} title="Нет транзакций" description="Появятся при активности пользователей" />
                        )}
                        {economy.typeBreakdown.map((tb) => {
                          const maxTotal = Math.max(...economy.typeBreakdown.map((x) => Math.abs(x.total)), 1);
                          const pct = (Math.abs(tb.total) / maxTotal) * 100;
                          const positive = tb.total >= 0;
                          return (
                            <div key={tb.type} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-zinc-300">{TX_TYPE_LABELS[tb.type] ?? tb.type}</span>
                                <span className="font-mono tabular-nums text-zinc-400">
                                  {fmtNum(tb.count)} · {fmtNum(tb.total)} 💎
                                </span>
                              </div>
                              <div className="h-1.5 bg-zinc-800/70 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${positive ? 'bg-amber-500/70' : 'bg-zinc-500/70'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </BentoTile>
                  </div>

                  {/* Transactions table */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-100">Транзакции</h3>
                      <p className="text-xs text-zinc-500 mt-0.5 font-mono tabular-nums">Всего: {fmtNum(economy.total)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {TX_FILTERS.map((t) => (
                        <button
                          key={t.value}
                          onClick={() => { setEcoType(t.value); setEcoPage(1); fetchEconomy(1, t.value); }}
                          className={`h-7 px-2.5 text-[11px] font-medium rounded-md border transition-colors active:translate-y-px ${
                            ecoType === t.value
                              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                              : 'bg-zinc-900/40 border-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700/80'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-800/60 overflow-hidden">
                    <div className="max-h-[28rem] overflow-y-auto sofia-scroll">
                      <Table>
                        <TableHeader className="sticky top-0 bg-zinc-950/95 backdrop-blur-sm z-10">
                          <TableRow className="border-zinc-800/60 hover:bg-transparent">
                            <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Пользователь</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Тип</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium text-right">Сумма</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Описание</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium text-right">Баланс</TableHead>
                            <TableHead className="text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Дата</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading.economy && Array.from({ length: 6 }).map((_, i) => (
                            <TableRow key={i} className="border-zinc-800/60">
                              {Array.from({ length: 6 }).map((__, j) => (
                                <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                              ))}
                            </TableRow>
                          ))}
                          {!loading.economy && economy.transactions.map((tx) => (
                            <TableRow key={tx.id} className="border-zinc-800/60 hover:bg-zinc-900/40 transition-colors">
                              <TableCell className="text-zinc-200 text-sm">
                                {tx.user.name ?? tx.user.firstName ?? tx.user.username ?? '-'}
                              </TableCell>
                              <TableCell>
                                <span className="text-[11px] text-zinc-300">{TX_TYPE_LABELS[tx.type] ?? tx.type}</span>
                              </TableCell>
                              <TableCell className={`text-right font-mono tabular-nums text-sm ${tx.amount >= 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                                {tx.amount >= 0 ? '+' : ''}{tx.amount}
                              </TableCell>
                              <TableCell className="text-zinc-500 text-xs max-w-32 truncate">{tx.description ?? '-'}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-zinc-300 text-sm">
                                {tx.balanceAfter ?? '-'}
                              </TableCell>
                              <TableCell className="text-zinc-500 text-xs font-mono tabular-nums whitespace-nowrap">{timeAgo(tx.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                          {!loading.economy && economy.transactions.length === 0 && (
                            <TableRow className="border-zinc-800/60">
                              <TableCell colSpan={6}>
                                <EmptyState icon={Wallet} title="Нет транзакций" description="Появятся при активности пользователей" />
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {economy.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={ecoPage <= 1}
                        onClick={() => { const p = ecoPage - 1; setEcoPage(p); fetchEconomy(p, ecoType); }}
                        className="h-8 border-zinc-800/70 bg-zinc-900/50 text-zinc-300 hover:text-zinc-100 active:translate-y-px disabled:opacity-40"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} /> Назад
                      </Button>
                      <span className="text-xs text-zinc-500 font-mono tabular-nums">
                        {ecoPage} / {economy.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={ecoPage >= economy.totalPages}
                        onClick={() => { const p = ecoPage + 1; setEcoPage(p); fetchEconomy(p, ecoType); }}
                        className="h-8 border-zinc-800/70 bg-zinc-900/50 text-zinc-300 hover:text-zinc-100 active:translate-y-px disabled:opacity-40"
                      >
                        Вперёд <ArrowRight className="w-3.5 h-3.5 ml-1.5" strokeWidth={1.5} />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabTransition>
          )}

          {/* DIGEST */}
          {activeTab === 'digest' && (
            <TabTransition className="space-y-5">
              <SectionHeader
                title="Дайджест"
                description="Превью недельной сводки, которую София отправляет админам каждое воскресенье."
                right={
                  digest?.lastSentAt ? (
                    <span className="text-xs text-zinc-400 font-mono tabular-nums">
                      Отправлен: {timeAgo(digest.lastSentAt)}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400 font-mono">Ещё не отправлялся на этой неделе</span>
                  )
                }
              />

              {!digest ? (
                <BentoTile interactive={false}><Skeleton className="h-64 w-full" /></BentoTile>
              ) : (
                <>
                  <BentoTile>
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 mb-1.5">
                          Период
                        </p>
                        <div className="text-lg font-semibold text-zinc-100 font-mono tabular-nums">
                          {new Date(digest.weekRange.from).toLocaleDateString('ru-RU')} - {new Date(digest.weekRange.to).toLocaleDateString('ru-RU')}
                        </div>
                      </div>
                      <Mail className="w-5 h-5 text-amber-400" strokeWidth={1.5} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4 border-t border-zinc-800/70">
                      <DigestStat icon={Users} label="Новых" value={digest.stats.newUsers} />
                      <DigestStat icon={Activity} label="Активны 7д" value={digest.stats.active7d} />
                      <DigestStat icon={MessageCircle} label="Сообщений" value={digest.stats.messages} />
                      <DigestStat icon={Sparkles} label="Раскладов" value={digest.stats.readings} />
                      <DigestStat icon={Gem} label="Кристаллов" value={digest.stats.crystalsSpent} />
                    </div>
                  </BentoTile>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <BentoTile>
                      <div className="flex items-center gap-2 mb-4">
                        <Crown className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                        <h3 className="text-sm font-semibold text-zinc-100">Топ-5 за неделю</h3>
                      </div>
                      <div className="space-y-1.5">
                        {digest.topUsers.length === 0 && (
                          <EmptyState icon={Users} title="Нет активных пользователей" description="Активные появятся на следующей неделе" />
                        )}
                        {digest.topUsers.map((u, i) => (
                          <div key={u.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-zinc-900/60 transition-colors">
                            <span className={`text-xs font-mono tabular-nums w-6 ${i < 3 ? 'text-amber-400' : 'text-zinc-500'}`}>
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-zinc-200 truncate">{u.name}</div>
                              <div className="text-[11px] text-zinc-500 font-mono truncate">
                                {u.username ? `@${u.username}` : ''}{u.zodiacSign ? ` · ${ZODIAC_EMOJI[u.zodiacSign] ?? ''} ${u.zodiacSign}` : ''}
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              <div className="font-mono tabular-nums text-zinc-200">{u.messageCount} сообщ.</div>
                              {u.streakDays > 0 && (
                                <div className="font-mono tabular-nums text-amber-400">🔥 {u.streakDays}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </BentoTile>

                    <BentoTile>
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                        <h3 className="text-sm font-semibold text-zinc-100">Расклады за неделю</h3>
                      </div>
                      <div className="space-y-2.5">
                        {digest.readingsByType.length === 0 && (
                          <EmptyState icon={Sparkles} title="Не было раскладов" description="На этой неделе не было раскладов" />
                        )}
                        {digest.readingsByType.map((r) => {
                          const max = digest.readingsByType[0]?.count ?? 1;
                          return (
                            <MiniBar
                              key={r.type}
                              label={READING_LABELS[r.type] ?? r.type}
                              value={r.count}
                              max={max}
                              display={fmtNum(r.count)}
                              color={READING_BAR_COLOR[r.type] ?? 'bg-amber-500/70'}
                            />
                          );
                        })}
                      </div>
                    </BentoTile>
                  </div>

                  {digest.recentBroadcasts.length > 0 && (
                    <BentoTile>
                      <div className="flex items-center gap-2 mb-4">
                        <Send className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                        <h3 className="text-sm font-semibold text-zinc-100">Рассылки на этой неделе</h3>
                      </div>
                      <div className="divide-y divide-zinc-800/70 -mx-1">
                        {digest.recentBroadcasts.map((b) => (
                          <div key={b.id} className="px-1 py-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-[11px] font-mono ${b.status === 'done' ? 'text-amber-400' : 'text-zinc-500'}`}>
                                {b.status === 'done' ? 'отправлено' : b.status}
                              </span>
                              <span className="text-[11px] text-zinc-500 font-mono tabular-nums">{timeAgo(b.createdAt)}</span>
                            </div>
                            <p className="text-sm text-zinc-300 line-clamp-2 mb-1">{b.text}</p>
                            <p className="text-[11px] text-zinc-500 font-mono tabular-nums">
                              Отправлено: {b.sentCount} / {b.total}{b.failedCount > 0 ? ` · ошибок: ${b.failedCount}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </BentoTile>
                  )}
                </>
              )}
            </TabTransition>
          )}

          {/* BROADCASTS */}
          {activeTab === 'broadcasts' && (
            <TabTransition className="space-y-5">
              <SectionHeader
                title="Рассылки"
                description="Отправка сообщений всем пользователям. Рассылка уходит асинхронно - бот забирает её из БД каждые 8 секунд."
              />

              <BentoTile>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-zinc-100">Новая рассылка</h3>
                  <span className={`text-[11px] font-mono tabular-nums ${broadcastText.length > 800 ? 'text-amber-400' : 'text-zinc-500'}`}>
                    {broadcastText.length} / 1024
                  </span>
                </div>
                <Textarea
                  placeholder="Текст рассылки. Поддерживается HTML-форматирование."
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  rows={5}
                  maxLength={1024}
                  className="bg-zinc-950/60 border-zinc-800/70 text-sm resize-none font-mono placeholder:text-zinc-600"
                />
                <div className="flex items-center justify-between gap-3 flex-wrap mt-3">
                  <p className="text-[11px] text-zinc-500 max-w-[60ch] leading-relaxed">
                    Рассылка отправится асинхронно - бот берёт её из БД каждые 8 секунд.
                  </p>
                  <Button
                    onClick={sendBroadcast}
                    disabled={sending || !broadcastText.trim()}
                    className="bg-amber-500 text-zinc-950 hover:bg-amber-400 active:translate-y-px disabled:opacity-40 shadow-sm shadow-amber-500/20"
                  >
                    <Send className={`w-4 h-4 mr-2 ${sending ? 'animate-pulse' : ''}`} strokeWidth={1.5} />
                    {sending ? 'Отправка...' : 'Отправить'}
                  </Button>
                </div>
              </BentoTile>

              <BentoTile>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-zinc-100">История рассылок</h3>
                  <span className="text-[11px] text-zinc-500 font-mono tabular-nums">{fmtNum(broadcasts.length)}</span>
                </div>
                <div className="divide-y divide-zinc-800/70 -mx-1 max-h-96 overflow-y-auto sofia-scroll">
                  {loading.broadcasts && <div className="px-1 py-3"><Skeleton className="h-16 w-full" /></div>}
                  {!loading.broadcasts && broadcasts.length === 0 && (
                    <EmptyState icon={Send} title="Рассылок пока не было" description="Создайте первую рассылку, чтобы уведомить пользователей" />
                  )}
                  {broadcasts.map((b) => (
                    <div key={b.id} className="px-1 py-2.5 hover:bg-zinc-900/40 transition-colors -mx-1 px-2 rounded">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[11px] font-mono ${b.status === 'done' ? 'text-amber-400' : 'text-zinc-500'}`}>
                          {b.status === 'done' ? 'отправлено' : b.status}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono tabular-nums">{timeAgo(b.createdAt)}</span>
                      </div>
                      <p className="text-sm text-zinc-300 line-clamp-2 mb-1">{b.text}</p>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-mono tabular-nums">
                        <span>Отправлено: {b.sentCount} / {b.total}</span>
                        {b.failedCount > 0 && <span className="text-rose-400">ошибок: {b.failedCount}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </BentoTile>
            </TabTransition>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
            <TabTransition className="space-y-5">
              <SectionHeader
                title="Настройки"
                description="Конфигурация бота в виде ключ / значение. Изменения применяются при следующем опросе ботом БД."
              />

              {!settingsData ? (
                <BentoTile interactive={false}><Skeleton className="h-64 w-full" /></BentoTile>
              ) : (
                <>
                  <BentoTile>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                        <h3 className="text-sm font-semibold text-zinc-100">Конфигурация бота</h3>
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono tabular-nums">
                        {fmtNum(settingsData.settings.length)} параметров
                      </span>
                    </div>
                    <div className="divide-y divide-zinc-800/70 max-h-[32rem] overflow-y-auto sofia-scroll -mx-1">
                      {settingsData.settings.map((s) => {
                        const isModified = editValues[s.key] !== s.value;
                        const isSaving = savingSettings[s.key] ?? false;
                        const isSaved = savedSettings[s.key] ?? false;
                        return (
                          <div key={s.id} className="px-1 py-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <code className="text-xs font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                                  {s.key}
                                </code>
                                {isModified && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400 bg-amber-500/5">
                                    изменён
                                  </span>
                                )}
                                {isSaved && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400 bg-amber-500/5 inline-flex items-center gap-1">
                                    <Check className="w-2.5 h-2.5" strokeWidth={2} /> сохранено
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-500 font-mono tabular-nums flex items-center gap-1">
                                <Clock className="w-3 h-3" strokeWidth={1.5} /> обновлено: {timeAgo(s.updatedAt)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                value={editValues[s.key] ?? s.value}
                                onChange={(e) => setEditValues((v) => ({ ...v, [s.key]: e.target.value }))}
                                className="w-56 h-8 bg-zinc-950/60 border-zinc-800/70 text-xs font-mono"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!isModified || isSaving}
                                onClick={() => saveSetting(s.key)}
                                className="h-8 w-8 p-0 border-zinc-800/70 bg-zinc-900/50 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/40 active:translate-y-px disabled:opacity-30"
                              >
                                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      {settingsData.settings.length === 0 && (
                        <EmptyState icon={Settings} title="Настроек пока нет" description="Появятся после первого запуска бота" />
                      )}
                    </div>
                  </BentoTile>

                  <BentoTile>
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
                      <h3 className="text-sm font-semibold text-zinc-100">Быстрые действия</h3>
                    </div>
                    <p className="text-xs text-zinc-500 mb-4 max-w-[60ch]">Массовые операции с подтверждением. Выполняются асинхронно при следующем опросе ботом БД.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setGiftDialogOpen(true)}
                        className="h-8 border-amber-500/40 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10 active:translate-y-px"
                      >
                        <Gift className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} /> Начислить всем
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetDialogOpen(true)}
                        className="h-8 border-rose-500/40 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 active:translate-y-px"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} /> Сбросить серии
                      </Button>
                    </div>
                  </BentoTile>

                  {/* Gift All Dialog */}
                  <AlertDialog open={giftDialogOpen} onOpenChange={setGiftDialogOpen}>
                    <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-100">Начислить кристаллы всем</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                          Каждый пользователь получит указанное количество кристаллов. Действие необратимо.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="py-2">
                        <Input
                          type="number"
                          value={giftAmount}
                          onChange={(e) => setGiftAmount(e.target.value)}
                          placeholder="Количество кристаллов"
                          className="bg-zinc-950/60 border-zinc-800/70 font-mono"
                          min={1}
                        />
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleGiftAll}
                          disabled={quickActionLoading}
                          className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
                        >
                          {quickActionLoading ? 'Выполнение...' : 'Начислить'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Reset Streaks Dialog */}
                  <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-100">Сбросить все серии</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                          Это сбросит streakDays у всех пользователей до 0. Действие необратимо.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">Отмена</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleResetStreaks}
                          disabled={quickActionLoading}
                          className="bg-rose-500 text-zinc-50 hover:bg-rose-400"
                        >
                          {quickActionLoading ? 'Выполнение...' : 'Сбросить'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </TabTransition>
          )}
        </main>

        {/* ─── Sticky footer ───────────────────────────────────── */}
        <footer className="mt-auto border-t border-zinc-800/60 bg-zinc-950">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span className="text-zinc-300 font-medium">Sofia Bot Admin</span>
              <span className="text-zinc-700">/</span>
              <span className="font-mono tabular-nums">v2.0</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <a
                href="https://t.me/oracultetris_bot"
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:text-amber-300 active:translate-y-px transition-colors font-mono"
              >
                @oracultetris_bot
              </a>
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────── */

function ZodiacBreakdown({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(ZODIAC_EMOJI).map(([name, emoji]) => ({
    name, emoji, count: counts[name] ?? 0,
  }));
  const sorted = entries.sort((a, b) => b.count - a.count);
  const total = sorted.reduce((a, b) => a + b.count, 0);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
      {sorted.map((e) => (
        <div key={e.name} className="flex items-center justify-between gap-2">
          <span className="text-zinc-400 truncate">
            <span className="mr-1">{e.emoji}</span>{e.name}
          </span>
          <span className={`font-mono tabular-nums ${e.count > 0 ? 'text-amber-400' : 'text-zinc-600'}`}>
            {e.count}
          </span>
        </div>
      ))}
      <div className="col-span-2 mt-1 pt-2 border-t border-zinc-800/70 flex justify-between text-[11px]">
        <span className="text-zinc-500 uppercase tracking-wider">Всего</span>
        <span className="font-mono tabular-nums text-zinc-300">{fmtNum(total)}</span>
      </div>
    </div>
  );
}

function HeroStat({ label, value, loading }: { label: string; value?: number; loading?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 mb-1">{label}</p>
      <div className="text-xl font-mono tabular-nums font-semibold text-zinc-100">
        {loading ? <Skeleton className="h-6 w-16" /> : <AnimatedNumber value={value ?? 0} />}
      </div>
    </div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono tabular-nums text-zinc-300">{fmtNum(value)}</span>
      </div>
      <div className="h-1.5 bg-zinc-800/70 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FlowBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono tabular-nums text-zinc-200">{fmtNum(value)}</span>
      </div>
      <div className="h-2 bg-zinc-800/70 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DigestStat({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number;
}) {
  return (
    <div className="space-y-1.5">
      <Icon className="w-4 h-4 text-amber-400" strokeWidth={1.5} />
      <div className="text-2xl font-mono tabular-nums font-semibold text-zinc-100">
        <AnimatedNumber value={value} />
      </div>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}

function ActivityChart({ buckets }: { buckets: ActivityBucket[] }) {
  const maxMsgs = Math.max(...buckets.map((b) => b.messages), 1);
  const maxReadings = Math.max(...buckets.map((b) => b.readings), 1);
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between text-[11px] mb-2 font-mono tabular-nums">
          <span className="text-zinc-500">макс. сообщений</span>
          <span className="text-zinc-400">{fmtNum(maxMsgs)}</span>
        </div>
        <div className="flex items-end gap-1 h-32">
          {buckets.map((b) => {
            const h = (b.messages / maxMsgs) * 100;
            return (
              <Tooltip key={b.date}>
                <TooltipTrigger asChild>
                  <div className="flex-1 group cursor-pointer">
                    <div
                      className="w-full rounded-t bg-amber-500/70 group-hover:bg-amber-400 transition-colors"
                      style={{ height: `${Math.max(2, h)}%` }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs font-mono tabular-nums">
                    <div>{shortDate(b.date)}</div>
                    <div className="text-amber-300">{fmtNum(b.messages)} сообщ.</div>
                    <div className="text-zinc-400">раскладов: {b.readings}</div>
                    <div className="text-zinc-400">новых: {b.newUsers}</div>
                    <div className="text-zinc-400">кристаллов: {b.crystalsSpent}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-[11px] mb-2 font-mono tabular-nums">
          <span className="text-zinc-500">макс. раскладов</span>
          <span className="text-zinc-400">{fmtNum(maxReadings)}</span>
        </div>
        <div className="flex items-end gap-1 h-12">
          {buckets.map((b) => {
            const h = (b.readings / maxReadings) * 100;
            return (
              <div key={b.date} className="flex-1">
                <div
                  className="w-full rounded-t bg-amber-500/30 hover:bg-amber-400/60 transition-colors"
                  style={{ height: `${Math.max(2, h)}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-zinc-500 font-mono tabular-nums">
        <span>{shortDate(buckets[0]?.date ?? new Date().toISOString())}</span>
        <span>{shortDate(buckets[buckets.length - 1]?.date ?? new Date().toISOString())}</span>
      </div>
    </div>
  );
}
