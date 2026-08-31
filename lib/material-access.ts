import { db } from "@/lib/db"
import type { MaterialAccessLocale } from "@/lib/material-access-policy"

export {
  createDefaultMaterialAccessPolicy,
  evaluateMaterialAccessPolicy,
  normalizeMaterialAccessPolicy,
} from "@/lib/material-access-policy"
export type {
  MaterialAccessCountry,
  MaterialAccessLocale,
  MaterialAccessMatchStrategy,
  MaterialAccessMode,
  MaterialAccessPolicyV2,
  MaterialAccessTeacher,
} from "@/lib/material-access-policy"
export async function isMaterialAccessPolicyReady() {
  const [row] = await db`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'materials'
        AND column_name = 'access_policy'
    ) AS ready
  `
  return row?.ready === true
}

export function materialAccessSql(teacherId: string, legacyLocale: MaterialAccessLocale) {
  return db`
    (
      (
        m.access_policy IS NULL
        AND m.language = ${legacyLocale}
        AND (
          m.category_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM teacher_categories legacy_tc
            WHERE legacy_tc.teacher_id = ${teacherId}
              AND legacy_tc.category_id = m.category_id
          )
        )
        AND (
          m.student_year IS NULL
          OR EXISTS (
            SELECT 1
            FROM teacher_student_years legacy_tys
            WHERE legacy_tys.teacher_id = ${teacherId}
              AND legacy_tys.student_year = m.student_year
          )
        )
        AND (
          COALESCE(m.access_scope, 'all') = 'all'
          OR EXISTS (
            SELECT 1
            FROM material_teacher_access legacy_mta
            WHERE legacy_mta.material_id = m.id
              AND legacy_mta.teacher_id = ${teacherId}
          )
        )
      )
      OR (
        (m.access_policy->>'version')::int = 2
        AND NOT (COALESCE(m.access_policy->'exclude_teacher_ids', '[]'::jsonb) ? ${teacherId})
        AND (
          COALESCE(m.access_policy->'include_teacher_ids', '[]'::jsonb) ? ${teacherId}
          OR m.access_policy->>'mode' = 'all'
          OR (
            m.access_policy->>'mode' = 'dynamic'
            AND (
              jsonb_array_length(COALESCE(m.access_policy->'locales', '[]'::jsonb))
              + jsonb_array_length(COALESCE(m.access_policy->'countries', '[]'::jsonb))
              + jsonb_array_length(COALESCE(m.access_policy->'student_years', '[]'::jsonb))
              + jsonb_array_length(COALESCE(m.access_policy->'category_ids', '[]'::jsonb))
            ) > 0
            AND (
              (
                COALESCE(m.access_policy->>'match_strategy', 'all') = 'all'
                AND (
                  jsonb_array_length(COALESCE(m.access_policy->'locales', '[]'::jsonb)) = 0
                  OR COALESCE(m.access_policy->'locales', '[]'::jsonb) ? COALESCE((SELECT locale FROM teachers WHERE id = ${teacherId}), '')
                )
                AND (
                  jsonb_array_length(COALESCE(m.access_policy->'countries', '[]'::jsonb)) = 0
                  OR COALESCE(m.access_policy->'countries', '[]'::jsonb) ? COALESCE((SELECT country FROM teachers WHERE id = ${teacherId}), '')
                )
                AND (
                  jsonb_array_length(COALESCE(m.access_policy->'student_years', '[]'::jsonb)) = 0
                  OR EXISTS (
                    SELECT 1
                    FROM teacher_student_years policy_tys
                    WHERE policy_tys.teacher_id = ${teacherId}
                      AND EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements_text(COALESCE(m.access_policy->'student_years', '[]'::jsonb)) selected_year(value)
                        WHERE selected_year.value = policy_tys.student_year::text
                      )
                  )
                )
                AND (
                  jsonb_array_length(COALESCE(m.access_policy->'category_ids', '[]'::jsonb)) = 0
                  OR EXISTS (
                    SELECT 1
                    FROM teacher_categories policy_tc
                    WHERE policy_tc.teacher_id = ${teacherId}
                      AND EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements_text(COALESCE(m.access_policy->'category_ids', '[]'::jsonb)) selected_category(value)
                        WHERE selected_category.value = policy_tc.category_id::text
                      )
                  )
                )
              )
              OR (
                COALESCE(m.access_policy->>'match_strategy', 'all') = 'any'
                AND (
                  (
                    jsonb_array_length(COALESCE(m.access_policy->'locales', '[]'::jsonb)) > 0
                    AND COALESCE(m.access_policy->'locales', '[]'::jsonb) ? COALESCE((SELECT locale FROM teachers WHERE id = ${teacherId}), '')
                  )
                  OR (
                    jsonb_array_length(COALESCE(m.access_policy->'countries', '[]'::jsonb)) > 0
                    AND COALESCE(m.access_policy->'countries', '[]'::jsonb) ? COALESCE((SELECT country FROM teachers WHERE id = ${teacherId}), '')
                  )
                  OR EXISTS (
                    SELECT 1
                    FROM teacher_student_years policy_tys
                    WHERE policy_tys.teacher_id = ${teacherId}
                      AND EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements_text(COALESCE(m.access_policy->'student_years', '[]'::jsonb)) selected_year(value)
                        WHERE selected_year.value = policy_tys.student_year::text
                      )
                  )
                  OR EXISTS (
                    SELECT 1
                    FROM teacher_categories policy_tc
                    WHERE policy_tc.teacher_id = ${teacherId}
                      AND EXISTS (
                        SELECT 1
                        FROM jsonb_array_elements_text(COALESCE(m.access_policy->'category_ids', '[]'::jsonb)) selected_category(value)
                        WHERE selected_category.value = policy_tc.category_id::text
                      )
                  )
                )
              )
            )
          )
        )
      )
    )
  `
}
