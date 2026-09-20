import type { AlmanacEntry } from '../../content/almanac';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
import { text } from './text';

export function CommandUnlock({ entry, onContinue }: { entry: AlmanacEntry; onContinue: () => void }) {
  return <Dialog title={text.commandUnlock.title} onClose={onContinue} dismissible={false} className="command-unlock" footer={<>
    <button className="button primary wide" onClick={onContinue}>{text.commandUnlock.continue}<Icon name="arrow" /></button>
    <p className="command-bookmark">{text.commandUnlock.bookmark}</p>
  </>}>
    <div className="command-heading"><span className="command-badge"><Icon name="book" /></span><h3><code>{entry.signature}</code></h3></div>
    <p>{entry.explanation}</p>
    {entry.parameters && <dl className="command-parameters">{entry.parameters.map(parameter => <div key={parameter.name}>
      <dt><code>{parameter.name}</code></dt><dd>{parameter.explanation}</dd>
    </div>)}</dl>}
    <div className="command-example"><pre>{entry.example}</pre><span aria-hidden="true">→</span><pre>{entry.output}</pre></div>
    {entry.comparison && <section className="command-comparison">
      <p>{entry.comparison.explanation}</p>
      <div className="command-example"><pre>{entry.comparison.example}</pre><span aria-hidden="true">→</span><pre>{entry.comparison.output}</pre></div>
    </section>}
    {entry.note && <p className="command-note">{entry.note}</p>}
  </Dialog>;
}
