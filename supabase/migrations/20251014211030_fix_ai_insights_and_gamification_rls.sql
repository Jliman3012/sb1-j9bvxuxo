/*
  # Fix RLS Policies for AI Insights and Gamification

  1. Changes
    - Add INSERT policy for ai_insights table
    - Add INSERT policy for gamification table
    - These were missing, preventing users from creating their own data

  2. Security
    - Policies ensure users can only insert their own data
    - Users cannot insert data for other users
*/

-- Add missing INSERT policy for ai_insights
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_insights' 
    AND policyname = 'Users can insert own insights'
  ) THEN
    CREATE POLICY "Users can insert own insights"
      ON ai_insights FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Add missing INSERT policy for gamification
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gamification' 
    AND policyname = 'Users can insert own gamification'
  ) THEN
    CREATE POLICY "Users can insert own gamification"
      ON gamification FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
