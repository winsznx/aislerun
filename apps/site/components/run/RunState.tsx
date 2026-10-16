import Link from "next/link";
import { Workspace } from "./Workspace";
import styles from "./run.module.css";

export function RunState({ crumbs, label, title, body }: { crumbs: { href: string; label: string }; label: string; title: string; body: string }) {
  return (
    <Workspace crumbs={[crumbs, { label }]}>
      <div className={styles.state}>
        <h1>{title}</h1>
        <p>{body}</p>
        <Link className="button secondary" href="/demo">See published runs</Link>
      </div>
    </Workspace>
  );
}
