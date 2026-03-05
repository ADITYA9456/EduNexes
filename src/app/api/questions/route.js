import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/questions — list questions with filters
export async function GET(request) {
  try {
    const { supabase } = createServerSupabase();
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');
    const type = searchParams.get('type');
    const search = searchParams.get('search');
    const tag = searchParams.get('tag');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('coding_problems')
      .select('id, title, slug, category, type, difficulty, tags, points, order_index, created_at', { count: 'exact' })
      .order('order_index', { ascending: true });

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }
    if (difficulty && difficulty !== 'All') {
      query = query.eq('difficulty', difficulty);
    }
    if (type && type !== 'All') {
      query = query.eq('type', type);
    }
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    if (tag) {
      query = query.contains('tags', [tag]);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: questions, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      questions: questions || [],
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/questions — create question (admin only)
export async function POST(request) {
  try {
    const { supabase, supabaseAdmin } = createServerSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title, slug, category, type, difficulty,
      tags, description, starter_code, test_cases,
      mcq_options, correct_answer, examples, constraints,
      points, order_index,
    } = body;

    if (!title || !description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    const { data: question, error } = await supabaseAdmin
      .from('coding_problems')
      .insert({
        title,
        slug: slug || undefined,
        category: category || 'DSA',
        type: type || 'code',
        difficulty: difficulty || 'Easy',
        tags: tags || [],
        description,
        starter_code: starter_code || {},
        test_cases: test_cases || [],
        mcq_options: mcq_options || [],
        correct_answer: correct_answer || '',
        examples: examples || [],
        constraints: constraints || [],
        points: points || 10,
        order_index: order_index || 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ question }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
