import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/questions/:slug — get single question by slug
export async function GET(request, { params }) {
  try {
    const { supabase } = createServerSupabase();
    const { slug } = params;

    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    // Try slug first, fall back to UUID
    let query;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

    if (isUUID) {
      query = supabase.from('coding_problems').select('*').eq('id', slug);
    } else {
      query = supabase.from('coding_problems').select('*').eq('slug', slug);
    }

    const { data: question, error } = await query.single();

    if (error || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ question });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/questions/:slug — update question (admin only)
export async function PUT(request, { params }) {
  try {
    const { supabase, supabaseAdmin } = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { slug } = params;
    const updates = await request.json();

    const { data: question, error } = await supabaseAdmin
      .from('coding_problems')
      .update(updates)
      .eq('slug', slug)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ question });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/questions/:slug — delete question (admin only)
export async function DELETE(request, { params }) {
  try {
    const { supabase, supabaseAdmin } = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { slug } = params;

    const { error } = await supabaseAdmin
      .from('coding_problems')
      .delete()
      .eq('slug', slug);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
