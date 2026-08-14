# Reference frame credits

These stills stand in for the registered footage. The audit in
`contracts/aperture.py` screenshots a reported page and compares it against the
frame for that asset, so the demo needs real imagery rather than the procedural
canvas used for the archive previews.

All five come from Wikimedia Commons and are reproduced under their original
licences. Nothing here is Aperture's work and none of it is public domain.

| File | Source | Author | Licence |
| --- | --- | --- | --- |
| `katla-caldera.jpg` | [View from Reynisfjara towards Mýrdalsjökull, Iceland](https://commons.wikimedia.org/wiki/File:View_from_Reynisfjara_towards_M%C3%BDrdalsj%C3%B6kull,_Iceland,_20230501_1658_4068.jpg) | Jakub Hałun | CC BY-SA 4.0 |
| `sable-drift.jpg` | [Namibie Skeleton Coast 01](https://commons.wikimedia.org/wiki/File:Namibie_Skeleton_Coast_01.JPG) | GIRAUD Patrick | CC BY 2.5 |
| `okavango-first-water.jpg` | [Cebras de Burchell, vista aérea del delta del Okavango, Botsuana](https://commons.wikimedia.org/wiki/File:Cebras_de_Burchell_(Equus_quagga_burchellii),_vista_a%C3%A9rea_del_delta_del_Okavango,_Botsuana,_2018-08-01,_DD_30.jpg) | Diego Delso | CC BY-SA 4.0 |
| `shuto-0400.jpg` | [Shuto expressway kasai jct](https://commons.wikimedia.org/wiki/File:Shuto_expressway_kasai_jct.jpg) | Hide1228 | CC BY-SA 3.0 |
| `kalsoy-ledge.jpg` | [Faroe Islands, Kalsoy](https://commons.wikimedia.org/wiki/File:Faroe_Islands,_Kalsoy.jpg) | Vincent van Zeijst | CC BY-SA 3.0 |

The files are served from the deployed app so the contract has a stable, self
hosted URL to fetch. Pointing the contract at upload.wikimedia.org directly was
the first approach and it rate limited under repeated requests, which would
have made audits fail for reasons that have nothing to do with the evidence.
