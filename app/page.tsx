'use client';

import { ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/utils/supabase';

export default function LandingPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateSplit = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error: insertError } = await supabase
        .from('sessions')
        .insert({})
        .select('id')
        .single();

      if (insertError || !data?.id) {
        throw new Error(insertError?.message ?? 'Unable to create a new room.');
      }

      router.push(`/room/${data.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to create a new room.');
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <aside className="hidden w-72 bg-zinc-950 p-6 md:block">
          <div className="mb-8 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-300" />
            <span className="text-sm font-semibold tracking-wide text-white">BillWizard</span>
          </div>
          <p className="text-sm leading-6 text-zinc-400">
            Create one URL. Invite everyone. Split in real time with no refresh.
          </p>
        </aside>

        <main className="flex flex-1 flex-col justify-center bg-slate-50 p-8 sm:p-10">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Smart Bill Splitter</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-500">
            Start a new collaborative room and share the link. Participants can join, assign items, and settle
            together live.
          </p>

          <button
            type="button"
            onClick={handleCreateSplit}
            disabled={isCreating}
            className="mt-6 inline-flex h-12 w-fit items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:bg-zinc-700"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {isCreating ? 'Creating Room...' : 'Create New Split'}
          </button>

          {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
        </main>
      </div>
    </div>
  );
}
