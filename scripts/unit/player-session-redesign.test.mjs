import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css=readFileSync(new URL('../../styles.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../../app.js',import.meta.url),'utf8');
test('player session redesign scopes new crimson styling to immersive player session',()=>{
 assert.match(css,/\.player-personalized\.immersive-shared \.imm-shared-hero/);
 assert.match(css,/\.player-personalized \.imm-shared-participant\.current/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)[\s\S]*\.player-personalized \.imm-shared-participant/);
});
test('shared player view keeps private-data warning and session hooks',()=>{
 assert.match(app,/Segredos e anotações particulares continuam ocultos/);
 for(const hook of ['data-imm-view="shared"','data-imm-view="personal"','data-imm-exit','combatOrderedParticipants\(combat\)']) assert.ok(app.includes(hook),`missing session hook ${hook}`);
});
test('shared player view uses specific gothic copy',()=>{
 assert.match(app,/ARQUIVO DA VIGÍLIA · VISÃO DO CÍRCULO/);
 assert.match(app,/SITUAÇÃO DOS SOBREVIVENTES/);
 assert.match(app,/Nenhuma presença foi inscrita no círculo desta vigília/);
});
