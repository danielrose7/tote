"use client";

import { usePasskeyAuth, useLogOut } from "jazz-tools/react";
import { APPLICATION_NAME } from "./constants";
import styles from "./AuthButton.module.css";

export function AuthButton() {
  const logOut = useLogOut();

  const auth = usePasskeyAuth({
    appName: APPLICATION_NAME,
  });

  function handleLogOut() {
    logOut();
    window.history.pushState({}, "", "/");
  }

  if (auth.state === "signedIn") {
    return (
      <button className={styles.button} onClick={handleLogOut}>
        Log out
      </button>
    );
  }

  return (
    <div className={styles.buttons}>
      <button className={styles.button} onClick={() => auth.signUp("")}>
        Sign up
      </button>
      <button onClick={() => auth.logIn()} className={styles.button}>
        Log in
      </button>
    </div>
  );
}
