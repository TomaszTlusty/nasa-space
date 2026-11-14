#!/usr/bin/env bash
# Downloads the raw NASA inputs (~530 MB) into data/raw/. Public, no login.
# LOLA polar DEMs (PDS, imbrium.mit.edu) and Mazarico et al. average Sun/Earth visibility maps (PGDA).
set -euo pipefail
cd "$(dirname "$0")/../.."
mkdir -p data/raw
cd data/raw

DEM=http://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG
ILL=http://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG

for f in LDEM_875S_20M LDEM_85S_40M LDEM_80S_80M LDEM_75S_240M; do
  for ext in IMG LBL; do
    [ -s "$f.$ext" ] || curl -fSL --retry 3 -o "$f.$ext" "$DEM/$f.$ext"
  done
done

for f in AVGVISIB_85S_060M_201608 AVGVISIB_85S_060M_201608_EARTH; do
  for ext in IMG LBL; do
    [ -s "$f.$ext" ] || curl -fSL --retry 3 -o "$f.$ext" "$ILL/$f.$ext"
  done
done

ls -la
