import { NextResponse } from 'next/server'
import {
  SKILLS,
  EMPLOYEES,
  BUNDLES,
  CATALOG_COUNTS,
  SKILL_CATEGORIES,
  EMPLOYEE_DIVISIONS,
} from '@/lib/marketplace-catalog'

/**
 * Marketplace catalog endpoint.
 *
 * Read-only, no auth required (the marketplace itself is the storefront —
 * customers browse before they buy). Returns the canonical list of 49
 * skills, 23 AI employees, and 7 bundles.
 */
export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  return NextResponse.json({
    counts: CATALOG_COUNTS,
    skillCategories: SKILL_CATEGORIES,
    employeeDivisions: EMPLOYEE_DIVISIONS,
    skills: SKILLS,
    employees: EMPLOYEES,
    bundles: BUNDLES,
  })
}
