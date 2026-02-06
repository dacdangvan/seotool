import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ai_seo_tool',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

export interface ValidationHistoryItem {
  id: string;
  project_id: string;
  input_type: 'url' | 'text';
  input_url: string | null;
  input_text: string | null;
  target_keyword: string | null;
  seo_score: number | null;
  seo_results: Record<string, unknown> | null;
  accuracy_score: number | null;
  duplicate_score: number | null;
  fact_score: number | null;
  brand_score: number | null;
  accuracy_results: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

// GET - Lấy lịch sử validation theo project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const id = searchParams.get('id'); // Get single item by ID

    if (!projectId && !id) {
      return NextResponse.json(
        { error: 'projectId or id is required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      // Get single item by ID
      if (id) {
        const result = await client.query(
          `SELECT * FROM validation_history WHERE id = $1`,
          [id]
        );

        if (result.rows.length === 0) {
          return NextResponse.json(
            { error: 'Validation history not found' },
            { status: 404 }
          );
        }

        return NextResponse.json(result.rows[0]);
      }

      // Get list with pagination
      const countResult = await client.query(
        `SELECT COUNT(*) as total FROM validation_history WHERE project_id = $1`,
        [projectId]
      );

      const result = await client.query(
        `SELECT 
          id,
          project_id,
          input_type,
          input_url,
          CASE WHEN input_text IS NOT NULL THEN LEFT(input_text, 100) || '...' ELSE NULL END as input_text_preview,
          target_keyword,
          seo_score,
          accuracy_score,
          duplicate_score,
          fact_score,
          brand_score,
          created_at,
          created_by
        FROM validation_history 
        WHERE project_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
        [projectId, limit, offset]
      );

      return NextResponse.json({
        items: result.rows,
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching validation history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch validation history' },
      { status: 500 }
    );
  }
}

// POST - Lưu kết quả validation mới
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      inputType,
      inputUrl,
      inputText,
      targetKeyword,
      seoScore,
      seoResults,
      accuracyScore,
      duplicateScore,
      factScore,
      brandScore,
      accuracyResults,
      createdBy,
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    if (!inputType || !['url', 'text'].includes(inputType)) {
      return NextResponse.json(
        { error: 'inputType must be "url" or "text"' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        `INSERT INTO validation_history (
          project_id,
          input_type,
          input_url,
          input_text,
          target_keyword,
          seo_score,
          seo_results,
          accuracy_score,
          duplicate_score,
          fact_score,
          brand_score,
          accuracy_results,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, created_at`,
        [
          projectId,
          inputType,
          inputUrl || null,
          inputText || null,
          targetKeyword || null,
          seoScore || null,
          seoResults ? JSON.stringify(seoResults) : null,
          accuracyScore || null,
          duplicateScore || null,
          factScore || null,
          brandScore || null,
          accuracyResults ? JSON.stringify(accuracyResults) : null,
          createdBy || null,
        ]
      );

      return NextResponse.json({
        success: true,
        id: result.rows[0].id,
        created_at: result.rows[0].created_at,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error saving validation history:', error);
    return NextResponse.json(
      { error: 'Failed to save validation history' },
      { status: 500 }
    );
  }
}

// DELETE - Xóa một bản ghi validation history
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      const result = await client.query(
        `DELETE FROM validation_history WHERE id = $1 RETURNING id`,
        [id]
      );

      if (result.rowCount === 0) {
        return NextResponse.json(
          { error: 'Validation history not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, deletedId: id });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting validation history:', error);
    return NextResponse.json(
      { error: 'Failed to delete validation history' },
      { status: 500 }
    );
  }
}
