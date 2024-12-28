import { Form, ActionPanel, Action, useNavigation } from "@raycast/api";

export default function Command() {
  const { push } = useNavigation();

  const handleSubmit = (values: { num1: string; num2: string }) => {
    const sum = parseInt(values.num1) + parseInt(values.num2);
    push(<Result sum={sum} />);
  };

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Calculate" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField id="num1" title="Number 1" placeholder="Enter first number" />
      <Form.TextField id="num2" title="Number 2" placeholder="Enter second number" />
    </Form>
  );
}

function Result({ sum }: { sum: number }) {
  return <>{`The sum is: ${sum}`}</>;
}