import { Link, Navigate, useParams } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { TOPIC_CONTENT } from '../content/topics';
import classes from './TopicDetailPage.module.css';

/**
 * Route component for /topic/:topicId — the classroom page for one topic.
 * Unknown ids redirect home to the library.
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
        <h1 style={{ '--i': 1 } as CSSProperties}>{content.title}</h1>
        <p className={classes.tagline} style={{ '--i': 2 } as CSSProperties}>
          {content.tagline}
        </p>
        <div style={{ '--i': 3 } as CSSProperties}>
          <Link to={content.simPath ?? '/playground'} className="btn btnPrimary">
            {content.simPath ? 'Open simulation' : 'Open the playground'}
          </Link>
        </div>
      </header>

      <div className={classes.sections}>
        <section className={classes.card}>
          <h2 className="caption">Definition</h2>
          <p className={classes.prose}>{content.definition}</p>
        </section>

        <section className={classes.card}>
          <h2 className="caption">Key concepts</h2>
          <ul className={classes.concepts}>
            {content.concepts.map((concept) => (
              <li key={concept}>{concept}</li>
            ))}
          </ul>
        </section>

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

        <section className={classes.card}>
          <h2 className="caption">Understanding</h2>
          {paragraphs.map((paragraph, index) => (
            <p key={index} className={classes.prose}>
              {paragraph}
            </p>
          ))}
        </section>
      </div>
    </div>
  );
}
