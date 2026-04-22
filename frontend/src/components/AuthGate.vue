<template>
  <section class="auth-gate">
    <div class="auth-card">
      <div class="auth-copy">
        <p class="eyebrow">ACDC</p>
        <h1>{{ title }}</h1>
        <p class="lead">
          Diagram editor for strict and free-form modeling. Authentication is required before you can access saved diagrams and custom types.
        </p>
      </div>

      <form class="auth-form" @submit.prevent="submitAuthForm">
        <label class="auth-field">
          <span>Email</span>
          <input
            :value="authForm.email"
            type="email"
            autocomplete="email"
            placeholder="name@example.com"
            @input="updateAuthField('email', $event.target.value)"
          />
        </label>

        <label v-if="authMode === 'register'" class="auth-field">
          <span>Display name</span>
          <input
            :value="authForm.display_name"
            type="text"
            autocomplete="name"
            placeholder="Your name"
            @input="updateAuthField('display_name', $event.target.value)"
          />
        </label>

        <label class="auth-field">
          <span>Password</span>
          <input
            :value="authForm.password"
            type="password"
            :autocomplete="authMode === 'register' ? 'new-password' : 'current-password'"
            placeholder="At least 8 characters"
            @input="updateAuthField('password', $event.target.value)"
          />
        </label>

        <p v-if="authError" class="auth-error">{{ authError }}</p>

        <button class="auth-submit" type="submit" :disabled="authLoading">
          {{ authLoading ? 'Please wait...' : primaryActionLabel }}
        </button>

        <button class="auth-toggle" type="button" @click="setAuthMode(authMode === 'login' ? 'register' : 'login')">
          {{ secondaryActionLabel }}
        </button>
      </form>
    </div>
  </section>
</template>

<script>
export default {
  name: 'AuthGate',
  props: {
    authMode: { type: String, required: true },
    authForm: { type: Object, required: true },
    authLoading: { type: Boolean, required: true },
    authError: { type: String, default: null },
    setAuthMode: { type: Function, required: true },
    updateAuthField: { type: Function, required: true },
    submitAuthForm: { type: Function, required: true },
  },
  computed: {
    title() {
      return this.authMode === 'register' ? 'Create your ACDC workspace' : 'Sign in to ACDC';
    },
    primaryActionLabel() {
      return this.authMode === 'register' ? 'Create account' : 'Sign in';
    },
    secondaryActionLabel() {
      return this.authMode === 'register' ? 'Already have an account? Sign in' : 'Need an account? Register';
    },
  },
};
</script>

<style scoped>
.auth-gate {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background:
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.14), transparent 32%),
    radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.18), transparent 30%),
    linear-gradient(135deg, #f8fbff 0%, #eef6ff 48%, #fff8ef 100%);
}

.auth-card {
  width: min(920px, 100%);
  display: grid;
  grid-template-columns: minmax(280px, 1.1fr) minmax(280px, 0.9fr);
  gap: 1.5rem;
  padding: 1.5rem;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(148, 163, 184, 0.28);
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.12);
}

.auth-copy {
  padding: 1rem;
}

.eyebrow {
  margin: 0 0 0.75rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #0f766e;
}

.auth-copy h1 {
  margin: 0 0 0.9rem;
  font-size: clamp(2rem, 4vw, 3.4rem);
  line-height: 0.95;
  color: #0f172a;
}

.lead {
  margin: 0;
  max-width: 32rem;
  font-size: 1rem;
  line-height: 1.6;
  color: #334155;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
  padding: 1rem;
  border-radius: 22px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #e2e8f0;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.auth-field span {
  font-size: 0.82rem;
  font-weight: 700;
  color: #475569;
}

.auth-field input {
  border: 1px solid #cbd5e1;
  border-radius: 14px;
  padding: 0.9rem 1rem;
  font-size: 0.98rem;
  color: #0f172a;
  background: #ffffff;
}

.auth-field input:focus {
  outline: 2px solid rgba(14, 165, 233, 0.18);
  border-color: #0ea5e9;
}

.auth-error {
  margin: 0;
  padding: 0.8rem 0.9rem;
  border-radius: 12px;
  background: #fff1f2;
  color: #be123c;
  font-size: 0.92rem;
}

.auth-submit,
.auth-toggle {
  border: 0;
  border-radius: 14px;
  padding: 0.95rem 1rem;
  font-size: 0.96rem;
  font-weight: 700;
  cursor: pointer;
}

.auth-submit {
  background: linear-gradient(135deg, #0f766e 0%, #0ea5e9 100%);
  color: #ffffff;
}

.auth-submit:disabled {
  opacity: 0.7;
  cursor: wait;
}

.auth-toggle {
  background: #e2e8f0;
  color: #0f172a;
}

@media (max-width: 800px) {
  .auth-card {
    grid-template-columns: 1fr;
  }
}
</style>
