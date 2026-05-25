CREATE TABLE votes_next (
  id text PRIMARY KEY NOT NULL,
  nomination_id text NOT NULL REFERENCES nominations(id),
  user_id text NOT NULL REFERENCES users(id),
  value text NOT NULL,
  comment text,
  created_at text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO votes_next (id, nomination_id, user_id, value, comment, created_at, updated_at)
SELECT id, nomination_id, user_id, value, comment, created_at, updated_at
FROM (
  SELECT
    votes.*,
    row_number() OVER (
      PARTITION BY nomination_id, user_id
      ORDER BY updated_at DESC, created_at DESC, id DESC
    ) AS vote_rank
  FROM votes
)
WHERE vote_rank = 1;

DROP TABLE votes;
ALTER TABLE votes_next RENAME TO votes;
CREATE UNIQUE INDEX votes_nomination_user_unique ON votes(nomination_id, user_id);
