import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ContactRecord } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contacts } = body as {
      contacts: ContactRecord[];
    };

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json(
        { error: 'contacts array is required' },
        { status: 400 }
      );
    }

    // Insert contacts into Supabase (upsert on phone_number)
    const { data, error } = await supabase
      .from('contacts')
      .upsert(contacts, {
        onConflict: 'phone_number',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: `Failed to save contacts: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      savedCount: data?.length || 0,
      contacts: data,
    });
  } catch (error) {
    console.error('Contacts API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save contacts' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .in('source', ['forager', 'aviato'])
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch contacts: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ contacts: data || [] });
  } catch (error) {
    console.error('Contacts GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}
