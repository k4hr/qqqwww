# REDFILM performance pass

- Homepage sections reduced from 12 to 8 cards to shrink HTML/RSC and mobile image work.
- Legacy fallback query reduced from 700 to 240 rows.
- Hero client props are mapped to an exact five-item DTO instead of serializing complete Prisma Movie objects.
- Hidden desktop hero poster is not mounted on mobile and is deferred on desktop.
- Movie-card responsive sizes were tightened and poster quality set to 66.
- Next Image uses WebP only to reduce cold-cache encoder latency.
- Yandex Metrika and Vibix global scripts are deferred beyond the initial rendering window.
