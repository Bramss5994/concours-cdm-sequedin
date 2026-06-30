
UPDATE public.players SET goals = 0, assists = 0;

INSERT INTO public.players (name, club, team_id, position, goals, assists)
SELECT 'Maximiliano Araujo', 'Sporting Portugal', t.id, 'FW', 0, 0
FROM public.teams t WHERE t.name = 'Uruguay'
AND NOT EXISTS (SELECT 1 FROM public.players WHERE lower(name) = 'maximiliano araujo');

WITH src(name_norm, goals) AS (
  VALUES
    ('lionel messi', 6),
    ('vinicius jr', 4),
    ('ousmane dembélé', 4),
    ('kylian mbappé', 4),
    ('erling haaland', 4),
    ('deniz undav', 3),
    ('harry kane', 3),
    ('matheus cunha', 3),
    ('jonathan david', 3),
    ('ismaël saibari', 3),
    ('elijah just', 3),
    ('brian brobbey', 3),
    ('yoane wissa', 3),
    ('ismaila sarr', 3),
    ('johan manzambi', 3),
    ('riyad mahrez', 2),
    ('kai havertz', 2),
    ('jude bellingham', 2),
    ('marko arnautovic', 2),
    ('leandro trossard', 2),
    ('ermin mahmic', 2),
    ('cyle larin', 2),
    ('daniel muñoz', 2),
    ('nicolas pépé', 2),
    ('mikel oyarzabal', 2),
    ('folarin balogun', 2),
    ('ramin rezaeian', 2),
    ('daichi kamada', 2),
    ('ayase ueda', 2),
    ('julián quiñones', 2),
    ('cody gakpo', 2),
    ('crysencio summerville', 2),
    ('cristiano ronaldo', 2),
    ('pape gueye', 2),
    ('yasin ayari', 2),
    ('anthony elanga', 2),
    ('ruben vargas', 2),
    ('maximiliano araujo', 2),
    ('thapelo maseko', 1),
    ('teboho mokoena', 1)
)
UPDATE public.players p
SET goals = s.goals
FROM src s
WHERE lower(p.name) = s.name_norm;
