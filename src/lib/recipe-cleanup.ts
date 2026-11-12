import type {RecipeDraft,RecipeSuggestion} from '../components/recipe-suggestion';

export function cleanupRecipeInput(draft:RecipeDraft):RecipeSuggestion{
 const lines=(text:string)=>text.split(/\r?\n/).map(line=>line.trim().replace(/^[・●•]\s*/, '').replace(/^(?:\d+[.．、)）:]|[-])\s+/, '').replace(/[\t　 ]+/g,' ')).filter(Boolean).join('\n');
 return {draft:{...draft,ingredients:lines(draft.ingredients),steps:lines(draft.steps)},warnings:['空行・行頭の番号・余分な空白を整理しました。食材や分量、手順の内容は提案・補完していません。'],mode:'refine',source:'input_cleanup'};
}
