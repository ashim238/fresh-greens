-- Fresh Greens moderator bootstrap
--
-- Run only after both migrations and after the intended moderator completes
-- Apple sign-in once. The owner-only helper refuses to run unless there is no
-- moderator and exactly one permanent user, so this seed cannot guess among
-- multiple accounts or promote an anonymous session.

SELECT private.bootstrap_first_moderator();
