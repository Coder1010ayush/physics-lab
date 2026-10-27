import { Link, Navigate, useParams } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { TOPIC_CONTENT } from '../content/topics';
import classes from './TopicDetailPage.module.css';

/**
 * Route component for /topic/:topicId — the classroom page for one topic.
 * Unknown ids redirect home to the library.
 *
 * Reading order mirrors how a teacher takes a class through a chapter:
 * the definition stated first and big (textbook voice), concepts numbered
 * like board notes, formulas featured centre-stage, then the explanation —
 * and every page ends pointing at the simulation that makes it move.
 */
export default function TopicDetailPage() {
  const { topicId } = useParams();
  const content = topicId !== undefined ? TOPIC_CONTENT[topicId] : undefined;

  if (content === undefined) {
    return <Navigate to="/" replace />;
  }

  const paragraphs = content.explanation.split('\n\n');

  return (
    <div className="container">
      <header className={`${classes.pageHead} enter`}>
        <Link to="/" className={classes.back} style={{ '--i': 0 } as CSSProperties}>
          ← Library
        </Link>
        <div style={{ '--i': 1 } as CSSProperties}>
          <span className="chip chipBrand">Classroom notes</span>
        </div>
        <h1 style={{ '--i': 2 } as CSSProperties}>{content.title}</h1>
        <p className={classes.tagline} style={{ '--i': 3 } as CSSProperties}>
          {content.tagline}
        </p>
        <div style={{ '--i': 4 } as CSSProperties}>
          <Link to={content.simPath ?? '/playground'} className="btn btnPrimary">
            {content.simPath ? 'Open simulation' : 'Open the playground'}
          </Link>
        </div>
      </header>

      <div className={classes.sections}>
        {/* Definition — the opening statement, textbook voice, no box */}
        <section className={classes.definition}>
          <h2 className="caption">Definition</h2>
          <p className={classes.definitionText}>{content.definition}</p>
        </section>

        {/* Key concepts — numbered like board notes */}
        <section className={classes.card}>
          <h2 className="caption">Key concepts</h2>
          <ol className={classes.concepts}>
            {content.concepts.map((concept, index) => (
              <li key={concept}>
                <span className={classes.conceptNum} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{concept}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Formulas — featured centre-stage */}
        <section className={classes.card}>
          <h2 className="caption">Formulas</h2>
          <div className={classes.formulaGrid}>
            {content.formulas.map((formula) => (
              <div key={formula.name} className={classes.formulaCard}>
                <span className="caption">{formula.name}</span>
                <var className={classes.formula}>{formula.formula}</var>
              </div>
            ))}
          </div>
        </section>

        {/* Understanding — a lead paragraph, then the rest */}
        <section className={classes.card}>
          <h2 className="caption">Understanding</h2>
          {paragraphs.map((paragraph, index) => (
            <p key={index} className={index === 0 ? classes.proseLead : classes.prose}>
              {paragraph}
            </p>
          ))}
        </section>

        {/* Payoff — reading ends where the simulation begins */}
        <section className={classes.payoff}>
          <h2 className={classes.payoffTitle}>See it move</h2>
          <p className={classes.payoffText}>
            Reading is step one — step two is pushing the sliders and watching the physics answer back.
          </p>
          <Link to={content.simPath ?? '/playground'} className="btn btnPrimary">
            {content.simPath ? 'Open the simulation' : 'Open the playground'}
          </Link>
        </section>
      </div>
    </div>
  );
}
