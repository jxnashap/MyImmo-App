-- =============================================================================
-- Bewerbungs-Seite: Verantwortlichen mitliefern (Art. 13 DSGVO)
-- =============================================================================
--
-- Auf `/bewerben/<token>` gibt ein völlig Fremder Nettoeinkommen, Arbeitgeber,
-- Beruf, Haushaltsgröße, SCHUFA-Angabe und eine Unterschrift ein — ohne zu
-- erfahren, WER diese Daten erhebt. Art. 13 Abs. 1 lit. a DSGVO verlangt die
-- Identität des Verantwortlichen zum Zeitpunkt der Erhebung.
--
-- Verantwortlicher ist der VERMIETER (MyImmo ist Auftragsverarbeiter, siehe
-- /avv). `bewerber_link_info` gab bisher nur Objektdaten heraus. Sie liefert
-- jetzt zusätzlich Name und Kontakt aus `vermieter_profil` — dieselben Felder,
-- die `beleihung_public_info` bereits als `absender` herausgibt.
--
-- Bewusst NICHT dabei: die Anschrift des Vermieters. Der Name plus eine
-- Kontaktmöglichkeit genügt der Informationspflicht an dieser Stelle; die
-- vollständige Anschrift eines Privatvermieters an jeden Link-Empfänger
-- herauszugeben wäre unverhältnismäßig. Fehlt das Profil, zeigt die Seite den
-- Ersatztext (siehe app/bewerben/[token]/page.tsx).
-- =============================================================================

create or replace function public.bewerber_link_info(p_token uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  l record;
  v record;
begin
  select bl.id, bl.user_id, bl.titel, p.bezeichnung, p.adresse, p.flaeche, p.zimmer
    into l
  from bewerber_links bl
  join properties p on p.id = bl.prop_id
  where bl.token = p_token and bl.aktiv;
  if not found then return null; end if;

  select name, email, telefon into v
  from vermieter_profil where user_id = l.user_id limit 1;

  return jsonb_build_object(
    'titel', l.titel,
    'objekt', l.bezeichnung,
    'adresse', l.adresse,
    'flaeche', l.flaeche,
    'zimmer', l.zimmer,
    'verantwortlicher', nullif(trim(coalesce(v.name, '')), ''),
    'verantwortlicher_email', nullif(trim(coalesce(v.email, '')), ''),
    'verantwortlicher_telefon', nullif(trim(coalesce(v.telefon, '')), '')
  );
end $function$;
