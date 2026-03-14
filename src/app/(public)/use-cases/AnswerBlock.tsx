import styles from "../docs/docs.module.css";

interface AnswerBlockProps {
  question: string;
  answer: string;
  accent: string;
  steps?: string[];
}

export function AnswerBlock({ question, answer, accent, steps }: AnswerBlockProps) {
  return (
    <section className={styles.answerBlock} style={{ "--answer-accent": accent } as React.CSSProperties}>
      <h2 className={styles.answerQuestion}>{question}</h2>
      <p className={styles.answerText}>{answer}</p>
      {steps && steps.length > 0 && (
        <ol className={styles.answerSteps}>
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
