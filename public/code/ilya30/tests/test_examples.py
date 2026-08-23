from examples.core_mechanisms import run_demo


def test_integrated_core_mechanisms_demo():
    results = run_demo()
    assert results["causal_attention"]["maximum_future_weight"] == 0.0
    assert results["ctc"]["absolute_difference"] < 1e-12
    assert results["prototypical_network"]["predictions"] == [0, 1]
    assert results["maml"]["meta_loss_after_full_step"] < results["maml"]["meta_loss_before"]
