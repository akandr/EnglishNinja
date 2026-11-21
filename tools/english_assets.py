#!/usr/bin/env python3
"""Copy the art and sounds English Ninja uses into assets/.

  python3 tools/english_assets.py <ninja_adventure_dir> <kenney_dir>

<ninja_adventure_dir> is the unpacked "Ninja Adventure - Asset Pack"
(Pixel-boy & AAA, CC0, https://pixel-boy.itch.io/ninja-adventure-asset-pack).
<kenney_dir> holds the unpacked Kenney packs (CC0, https://kenney.nl):
  k_tiny-dungeon/, k_tiny-town/, k_particle-pack/
Audio: ogg for most browsers + mp3 for Safari.
"""
import pathlib, shutil, subprocess, sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
PACK = pathlib.Path(sys.argv[1])
OUT = ROOT / "assets"
K = pathlib.Path(sys.argv[2])

HEROES = ["NinjaFire", "NinjaWater", "NinjaThunder", "NinjaMasked"]
PEOPLE = ["Sultan", "Sultan2", "Woman", "Shaman", "Monk2", "Cavegirl", "Knight", "KnightGold", "Princess",
          "Villager5", "OldMan3", "OldWoman", "Master", "SamuraiBlue", "EggGirl"]
CREATURES = ["Flam", "Lizard", "Mollusc", "Snake", "Butterfly", "Larva", "Axolot", "Mole", "Spirit", "Eye", "Skull",
             "LanternRed", "LanternGreen", "Owl", "BlueBat", "HeartRed", "YellowsBat"]
TILES = {"TilesetDesert.png": "Backgrounds/Tilesets/TilesetDesert.png",
         "TilesetVillageAbandoned.png": "Backgrounds/Tilesets/TilesetVillageAbandoned.png",
         "TilesetTowers.png": "Backgrounds/Tilesets/TilesetTowers.png",
         "TilesetInteriorFloor.png": "Backgrounds/Tilesets/Interior/TilesetInteriorFloor.png",
         "TilesetClouds.png": "Backgrounds/Tilesets/TilesetFloorB.png"}
FX = {"Shuriken.png": "FX/Projectile/Shuriken.png", "Smoke.png": "FX/Smoke/Smoke/SpriteSheet.png",
      "Leaf.png": "FX/Particle/Leaf.png", "Clouds.png": "FX/Particle/Clouds.png",
      # the ninjas' elements: what their shurikens leave behind and do when they hit
      "e_flam.png": "FX/Elemental/Flam/SpriteSheet.png", "e_fire.png": "FX/Particle/Fire.png",
      "e_water.png": "FX/Elemental/Water/SpriteSheet.png", "e_thunder.png": "FX/Elemental/Thunder/SpriteSheet.png",
      "e_ice.png": "FX/Elemental/Ice/SpriteSheetB.png", "e_flake.png": "FX/Elemental/Ice/SpriteSheetFlake.png",
      "e_snow.png": "FX/Particle/Snow.png"}
# Kenney Particle Pack: white shapes on transparency, shrunk (the game tints them)
PARTICLES = ["star_07", "star_04", "magic_02", "circle_05", "light_01", "twirl_02", "smoke_04", "spark_05"]
MUSIC = {"oasis": "20 - Good Time.ogg", "temple": "12 - Temple.ogg", "dungeon": "21 - Dungeon.ogg",
         "village": "33 - Calm Village.ogg", "sky": "19 - Ascension.ogg"}
SFX = {"throw": "Whoosh & Slash/Whoosh.wav", "boing": "Jump & Bounce/Bounce2.wav", "poof": "Magic & Skill/Magic1.wav",
       "open": "Magic & Skill/Heal2.wav", "chase": "Hit & Impact/Hit3.wav"}


def audio(src, dst, music=False):
    dst.parent.mkdir(parents=True, exist_ok=True)
    a = ["-ar", "44100"] + (["-b:a", "96k"] if music else [])
    for ext, codec in (("ogg", ["-c:a", "libvorbis", "-q:a", "3" if music else "4"]), ("mp3", ["-c:a", "libmp3lame"])):
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), *a, *codec, str(dst.with_suffix("." + ext))], check=True)


def main():
    for sub in ("heroes", "people", "creatures", "tiles", "fx", "music"):
        (OUT / sub).mkdir(parents=True, exist_ok=True)
    for h in HEROES:
        shutil.copy2(PACK / "Actor/Character" / h / "SpriteSheet.png", OUT / "heroes" / f"{h}.png")
        shutil.copy2(PACK / "Actor/Character" / h / "Faceset.png", OUT / "heroes" / f"{h}_face.png")
    for p in PEOPLE:
        shutil.copy2(PACK / "Actor/Character" / p / "SpriteSheet.png", OUT / "people" / f"{p}.png")
    for c in CREATURES:
        src = [f for f in (PACK / "Actor/Monster" / c).glob("*.png") if "Faceset" not in f.name][0]
        shutil.copy2(src, OUT / "creatures" / f"{c}.png")
    for d, s in TILES.items():
        shutil.copy2(PACK / s, OUT / "tiles" / d)
    shutil.copy2(K / "k_tiny-dungeon/Tilemap/tilemap_packed.png", OUT / "tiles" / "KenneyTinyDungeon.png")
    shutil.copy2(K / "k_tiny-town/Tilemap/tilemap_packed.png", OUT / "tiles" / "KenneyTinyTown.png")
    for d, s in FX.items():
        shutil.copy2(PACK / s, OUT / "fx" / d)
    for p in PARTICLES:
        im = Image.open(K / "k_particle-pack/PNG (Transparent)" / f"{p}.png").convert("RGBA").resize((128, 128), Image.LANCZOS)
        im.save(OUT / "fx" / f"k_{p}.png", optimize=True)
    for k, f in MUSIC.items():
        audio(PACK / "Audio/Musics" / f, OUT / "music" / k, music=True)
    for k, f in SFX.items():
        audio(PACK / "Audio/Sounds" / f, OUT / "sfx" / k)
    print("ok ->", OUT)


if __name__ == "__main__":
    main()
