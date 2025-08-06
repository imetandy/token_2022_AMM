import { createFromRoot } from 'kinobi';
import { AnchorIdl, rootNodeFromAnchor } from '@kinobi-so/nodes-from-anchor';
import { renderVisitor as renderJavaScriptVisitor } from "@kinobi-so/renderers-js";
import anchorIdl from './target/idl/amm.json';
import path from 'path';

const kinobi = createFromRoot(rootNodeFromAnchor(anchorIdl as AnchorIdl));

const typesOutput = path.join("app", "app", "types");
  
kinobi.accept(
  renderJavaScriptVisitor(path.join(typesOutput, "generated"))
);