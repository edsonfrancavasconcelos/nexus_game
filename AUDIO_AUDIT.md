# Auditoria do sistema de áudio

## Inventário atual

Os 14 arquivos-fonte abaixo existem em `public/assets/sounds/`. O build copia esses mesmos arquivos para `dist/assets/sounds/`.

| Arquivo | Carregado em | Utilização / reprodução |
|---|---|---|
| `nave.mp3` | `src/SoundManager.js` (`shipEngine`) | Motor/voo contínuo do jogador. Inicia no início do jogo e ao retomar; pausa quando o jogo é pausado ou a página fica oculta. |
| `laser.mp3` | `src/SoundManager.js` (`playerShot`) | Tiros da nave: disparos básicos em `src/LaserManager.js` e mísseis em `src/Player.js`. |
| `pdc_shot.mp3` | `src/SoundManager.js` (`pdc`) | Disparos dos canhões PDC em `src/Player.js`. |
| `laser_inimigo.mp3` | `src/SoundManager.js` (`enemyLaser`) | Tiros de inimigos comuns e fallback dos inimigos do nível 6, acionados por `src/EnemyManager.js`. |
| `laser_inim_15.mp3` | `src/SoundManager.js` (`laser_inim_15`) | Tiros dos inimigos de nível 51 ou superior em `src/EnemyManager.js`. |
| `laser_inim_10.mp3` | `src/SoundManager.js` (`laser_inim_10`) | Tiros dos inimigos de nível 31 ou superior em `src/EnemyManager.js`. |
| `laser_inimi_5.mp3` | `src/SoundManager.js` (`laser_inimi_5`) | Tiros dos inimigos de nível 21 ou superior em `src/EnemyManager.js`. |
| `explosao_inimiga.mp3` | `src/SoundManager.js` (`explosion`) | Explosões criadas em `src/ExplosionManager.js`, inclusive impactos processados por `src/EnemyManager.js` e `src/LaserManager.js`. |
| `inimiga_passando.mp3` | `src/SoundManager.js` (`enemyPass`) | Passagem de inimigos comuns em `src/EnemyManager.js`; também é o fallback do grupo de nível 6. |
| `drone.mp3` | `src/SoundManager.js` (`drone`) | Passagem de inimigos do tipo drone em `src/EnemyManager.js`. |
| `meteoro.mp3` | `src/SoundManager.js` (`meteoro`) | Passagem de meteoros/asteroides em `src/EnemyManager.js` e colisão com planeta em `src/SpaceEnvironment.js`. |
| `nave_pass_15.mp3` | `src/SoundManager.js` (`nave_pass_15`) | Passagem de inimigos do nível 51 ou superior em `src/EnemyManager.js`. |
| `nave_pss_10.mp3` | `src/SoundManager.js` (`nave_pss_10`) | Passagem de inimigos do nível 31 ou superior em `src/EnemyManager.js`. |
| `nave_pass_5.mp3` | `src/SoundManager.js` (`nave_pass_5`) | Passagem de inimigos do nível 21 ou superior em `src/EnemyManager.js`. |

O carregamento de todos os efeitos é centralizado em `src/SoundManager.js`. As chamadas de reprodução passam pelo `SoundManager`; as chamadas do motor usam `startShipEngine()` e `stopShipEngine()`.

## Verificação obrigatória

- `nave.mp3` está associado exclusivamente a `shipEngine`, com reprodução em loop; nenhum disparo referencia esse nome.
- `laser.mp3` está associado a `playerShot`, usado tanto pelo tiro básico quanto pelo disparo de míssil do jogador.
- O conteúdo original do motor está em `nave.mp3`; o conteúdo original do tiro está em `laser.mp3`.
- Não há referências de áudio a `nave2.mp3`, `laser2.mp3` ou ao inexistente `nave_pass_10.mp3` no código atual.

## Problemas encontrados e corrigidos

- O tiro básico e o míssil do jogador usavam `laser.mp3`, enquanto o motor era carregado de `nave.mp3`. Os arquivos e as referências foram reorganizados para manter o motor em `nave.mp3` e os tiros em `laser.mp3`, sem descartar nenhum dos dois conteúdos originais.
- O gerenciador criava vários elementos `Audio` para o mesmo caminho (por exemplo, aliases de `laser_inimigo.mp3`, `drone.mp3`, `meteoro.mp3` e `inimiga_passando.mp3`). Agora cada caminho distinto tem um único elemento-base; aliases resolvem para a mesma chave e pool.
- O nome `nave_pass_10.mp3` era carregado apesar de o arquivo existente se chamar `nave_pss_10.mp3`. A referência foi corrigida.
- Chamadas repetidas para iniciar o motor não eram explicitamente idempotentes e a pausa do jogo não pausava o motor. O motor agora não reinicia se já estiver tocando e é pausado/retomado junto com os controles de pausa e a mudança de visibilidade.
- Os efeitos já tinham limite de instâncias e pool, mas aliases de um mesmo arquivo mantinham contadores/pools separados. Agora limites, cooldowns e pools são aplicados à chave canônica; os elementos encerrados ou cuja reprodução falha retornam ao pool.
- `preload = 'none'` permanece para evitar carregamento antecipado de todos os efeitos. A base de cada áudio é criada uma vez, e os elementos clonados para sobreposição são reutilizados pelo pool. A implementação usa elementos HTML `Audio` (o navegador gerencia o buffer decodificado), não objetos `AudioBuffer` da Web Audio API.

## Duplicatas, uso e arquivos sem uso

- Nenhum dos 14 arquivos-fonte atuais está sem uso.
- A comparação SHA-256 dos arquivos-fonte não encontrou arquivos com conteúdo duplicado.
- A auditoria inicial encontrou em `dist/` artefatos de build antigos: `laser2.mp3` duplicava o conteúdo do antigo `public/assets/sounds/laser.mp3`, e o `dist/assets/sounds/laser.mp3` não correspondia ao arquivo-fonte. O build foi regenerado; `dist/assets/sounds/` agora corresponde ao inventário atual e não contém `laser2.mp3`.
- Não há reprodução simultânea ilimitada do mesmo efeito: cada chave canônica tem um teto de instâncias. Sobreposição limitada de tiros e efeitos é intencional. O motor é uma única instância em loop, separada dos efeitos.

## Validação

- `npm run build`: concluído com sucesso.
- Verificação do Problems panel: sem erros nos arquivos alterados.
- `git diff --check`: sem erros de whitespace.
- O build emite um aviso de que o chunk Three.js excede 500 kB; não está relacionado a áudio.
