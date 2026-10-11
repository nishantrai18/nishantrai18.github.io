# Third-party sources

The layout and styles are custom, informed by ImageGen concepts and references including [Academic Homepage](https://github.com/luost26/academic-homepage), [Jon Barron](https://jonbarron.info/), [Anay Mehrotra](https://anaymehrotra.com/), and [Amlan Kar](https://amlankar.github.io/). No code from those websites is included.

## Fonts

Inter and Source Serif 4 are distributed under the SIL Open Font License. License copies are preserved beside the self-hosted files in `assets/fonts/`. Source Serif 4 comes from Google Fonts; its upstream family is Adobe’s Source Serif. Legacy font files retain their original licenses.

## Profile and research images

These images retain their creators’ rights; this project does not license them to third parties.

| Asset | Public source |
| --- | --- |
| `assets/images/portrait.jpg` | [Nishant’s original profile photo](https://nishantrai18.github.io/img/profile_pic.jpeg) |
| `assets/images/homage.png` | [Home Action Genome repository](https://github.com/nishantrai18/homage) |
| `assets/images/cocon.png` | [CoCon repository](https://github.com/nishantrai18/cocon) |
| `assets/images/adascan.jpg` | [AdaScan project](https://amlankar.github.io/publication/adascan/) |
| `assets/images/surface-mapping.webp` | Figure 1(c), page 1 of [Weak Multi-View Supervision for Surface Mapping Estimation](https://arxiv.org/pdf/2105.01388) |
| `assets/images/gpmvc.webp` | Figure 1, page 2 of [Partial Multi-View Clustering using Graph Regularized NMF](https://nishantrai18.github.io/resources/gpmvcICPR16.pdf) |

The last two thumbnails are cropped original paper figures. Research diagrams preserve their composition in the displayed image frames.

## Launch and article thumbnails

Official OpenAI artwork in `assets/images/work/` comes from these announcement pages:

| Asset | Public source |
| --- | --- |
| `gpt6-astra.webp` | [GPT-6 Astra](https://openai.com/index/gpt-6-astra/) |
| `gpt6.webp` (alternate) | [GPT-6 for everyone](https://openai.com/index/gpt-6-for-everyone/) |
| `gpt56.webp` | [GPT-5.6](https://openai.com/index/gpt-5-6/) |
| `gpt55.webp` | [Introducing GPT-5.5](https://openai.com/index/introducing-gpt-5-5/) |
| `gpt54.webp` | [Introducing GPT-5.4](https://openai.com/index/introducing-gpt-5-4/) |
| `gpt52.webp` | [Introducing GPT-5.2](https://openai.com/index/introducing-gpt-5-2/) |
| `gpt5.webp` | [Introducing GPT-5](https://openai.com/index/introducing-gpt-5/) |
| `o3.webp` | [Introducing OpenAI o3 and o4-mini](https://openai.com/index/introducing-o3-and-o4-mini/) |
| `company-knowledge.webp` | [Company knowledge in ChatGPT](https://openai.com/index/introducing-company-knowledge/) |

Waymo images in the same directory come from:

| Asset | Public source |
| --- | --- |
| `waymo-ai.jpg` | Cover of [Behind the Innovation: AI & ML at Waymo](https://waymo.com/blog/2024/10/ai-and-ml-at-waymo/) |
| `waymo-safe-ai.png` | Hero artwork from [Demonstrably Safe AI for Autonomous Driving](https://waymo.com/blog/2025/12/demonstrably-safe-ai-for-autonomous-driving/) |
| `keypoints.jpg` | Static capture of the demonstration in [Utilizing key point and pose estimation for autonomous driving](https://waymo.com/blog/2022/02/utilizing-key-point-and-pose-estimation/) |

The Waymo AI cover illustrates the linked article, not a patent figure. The keypoint image uses a still frame to avoid automatically playing animation. These images retain the rights of OpenAI, Waymo, and their respective creators and identify the linked work.

## Generated illustrations

The twelve cobalt illustrations in `assets/images/work/art/` were generated with ImageGen for this website. They are optional abstract editorial illustrations, not official launch artwork or technical diagrams.

## Small SVG icons

- Google Scholar, LinkedIn, GitHub, and Quora: [Font Awesome Free 6.7.2](https://github.com/FortAwesome/Font-Awesome/tree/6.7.2/svgs/brands), by Fonticons, Inc., under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Upstream paths, viewBoxes, and license comments are retained in `_includes/icons/`. LinkedIn uses the unboxed `linkedin-in` mark.
- OpenAI: [Simple Icons 11.15.0](https://github.com/simple-icons/simple-icons/tree/11.15.0), distributed under CC0-1.0. Original path geometry is retained.
- Waymo: original vector paths from the public [Waymo homepage](https://waymo.com/), with a monochrome treatment and tightened viewBox.
- Other interface icons are local SVG markup in `_includes/icon.html`.

Brand marks remain trademarks of their respective owners.

## Affiliation strip

Nuro, Stanford, Fyusion, Rubrik, and IIT Kanpur images come from Nishant’s [original public website](https://nishantrai18.github.io/). Downloaded files remain in `assets/images/affiliations/`; CSS controls their display size and color treatment. The IIT Kanpur image is stored as GIF to match its actual format. Organization marks remain the property of their owners.

## Local runtime

The optional Apple Silicon bootstrap uses official [ruby/ruby-builder](https://github.com/ruby/ruby-builder) release artifacts and public Homebrew bottles, verified against fixed SHA-256 digests. Runtime files remain in ignored `.local/` and are excluded from website output. Gems retain their upstream licenses.

Private design and provenance notes remain local and are excluded from Git and website output.
