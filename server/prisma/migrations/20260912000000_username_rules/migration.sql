-- The API normalizes usernames before writing. Restrict every database writer
-- to the approved lowercase format so the existing unique index also enforces
-- case-insensitive identity. Existing invalid data must be reviewed, not renamed.
ALTER TABLE "User"
ADD CONSTRAINT "User_username_format_check"
CHECK ("username" COLLATE "C" ~ '^[a-z0-9_]{3,24}$');
