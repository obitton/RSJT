#!/usr/bin/env bash
# SessionStart hook for cloud sessions (see .claude/settings.json). Installs
# dependencies, starts the Postgres the tests expect on port 54329, and migrates
# and seeds rsjt_dev. Hook stdout becomes session context, so each step prints
# one status line and keeps its full output in $log_dir.

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
log_dir=/tmp/rsjt-cloud-setup
mkdir -p "$log_dir"

run_step() {
  local name=$1
  shift
  "$@" >"$log_dir/$name.log" 2>&1
  local rc=$?
  if [ "$rc" -eq 0 ]; then
    echo "cloud setup: $name ok"
  else
    echo "cloud setup: $name failed (exit $rc), log in $log_dir/$name.log"
  fi
  return "$rc"
}

# Planning docs come from a private repo (see AGENTS.md). The session can clone
# it only when the repo is attached to the session.
pm_repo=https://github.com/obitton/rsjt-project-management
if [ -d .project-management/.git ]; then
  run_step project-management git -C .project-management pull --ff-only
elif [ -e .project-management ]; then
  echo "cloud setup: .project-management exists but is not a clone of $pm_repo, left as is"
else
  run_step project-management git clone "$pm_repo" .project-management ||
    echo "cloud setup: attach obitton/rsjt-project-management to this session to get the planning docs"
fi

# The db scripts read DATABASE_URL from .env.
[ -f .env ] || cp .env.example .env

run_step install pnpm install --frozen-lockfile

if ! docker info >/dev/null 2>&1; then
  service docker start >"$log_dir/dockerd.log" 2>&1 ||
    (nohup dockerd >>"$log_dir/dockerd.log" 2>&1 &)
  for _ in $(seq 1 30); do
    docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
if ! docker info >/dev/null 2>&1; then
  echo "cloud setup: docker is not reachable, Postgres not started, log in $log_dir/dockerd.log"
  exit 0
fi

run_step db-up pnpm db:up || exit 0

container=$(docker ps --filter "publish=54329" --format "{{.Names}}" | head -n 1)
ready=no
for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -U rsjt -d rsjt_dev >/dev/null 2>&1; then
    ready=yes
    break
  fi
  sleep 1
done
if [ "$ready" != yes ]; then
  echo "cloud setup: Postgres container '${container}' did not become ready on port 54329"
  exit 0
fi

run_step migrate pnpm --filter @rsjt/db migrate || exit 0

# The seed has no conflict handling, so a second run fails on duplicate keys.
if pnpm --filter @rsjt/db seed >"$log_dir/seed.log" 2>&1; then
  echo "cloud setup: seed ok"
elif grep -q "duplicate key" "$log_dir/seed.log"; then
  echo "cloud setup: seed skipped, rsjt_dev was already seeded"
else
  echo "cloud setup: seed failed, log in $log_dir/seed.log"
fi

echo "cloud setup: Postgres container $container is ready on port 54329 (rsjt_dev)"
exit 0
