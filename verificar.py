import json

with open('questoes.json', encoding='utf-8') as f:
    questoes = json.load(f)

bancas = set(q['banca'] for q in questoes)
materias = set(q['materia'] for q in questoes)
print('Bancas:', bancas)
print('Matérias:', materias)
print('Total:', len(questoes))